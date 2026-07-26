import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  npmCommandName,
  npmScriptArgs,
} from '../infrastructure/commands/npm-command.mjs';
import { loadValidatedConfig } from '../infrastructure/config/validated-config.mjs';
import { checkBackend } from './backend.mjs';
import { createCleanup } from './cleanup.mjs';
import { checkFrontend } from './frontend.mjs';
import { checkMinio } from './minio.mjs';
import { checkPostgres } from './postgres.mjs';
import { startManagedProcess, runCaptured } from './processes.mjs';
import { createReport } from './report.mjs';
import { formatError } from './utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

export async function runDoctor() {
  const managedProcesses = [];
  const managedServices = [];
  const cleanupState = { started: false };
  const initialEnv = snapshotProcessEnv();
  const report = createReport();
  let finalExitCode = 0;
  let interrupted = false;
  let removeShutdownHandlers = () => {};

  const cleanupOnce = createCleanup({
    cleanupState,
    managedProcesses,
    managedServices,
    report,
    runCaptured: (command, args, options = {}) =>
      runCaptured(command, args, {
        cwd: projectRoot,
        ...options,
      }),
  });

  const startProcess = (name, command, args, options = {}) =>
    startManagedProcess(name, command, args, {
      cleanupState,
      isShuttingDown: () => cleanupState.started || interrupted,
      managedProcesses,
      projectRoot,
      report,
      ...options,
    });

  const finalizeOnce = createFinalizer({
    cleanupOnce,
    initialEnv,
    report,
  });

  removeShutdownHandlers = installShutdownHandlers({
    finalizeOnce,
    setInterrupted: () => {
      interrupted = true;
    },
  });

  try {
    const npm = npmCommandName();
    const { config, doctorEnv } = await checkConfiguration({ report });
    const {
      DeleteObjectCommand,
      GetObjectCommand,
      HeadBucketCommand,
      PgClient,
      PutObjectCommand,
      S3Client,
    } = loadBackendDependencies();

    const postgres = await checkPostgres({
      config,
      cleanupState,
      env: doctorEnv,
      isShuttingDown: () => cleanupState.started || interrupted,
      managedServices,
      npm,
      PgClient,
      projectRoot,
      report,
      runCaptured: (command, args, options = {}) =>
        runCaptured(command, args, {
          cwd: projectRoot,
          ...options,
        }),
    });
    const minio = await checkMinio({
      config,
      DeleteObjectCommand,
      GetObjectCommand,
      HeadBucketCommand,
      PutObjectCommand,
      report,
      S3Client,
      startManagedProcess: startProcess,
    });

    await checkBackend({
      config,
      minio,
      npm,
      npmScriptArgs,
      postgres,
      report,
      startManagedProcess: startProcess,
    });
    await checkFrontend({
      config,
      npm,
      npmScriptArgs,
      report,
      startManagedProcess: startProcess,
    });
  } catch (error) {
    report.add('Project', 'ERROR', formatError(error));
    finalExitCode = Math.max(finalExitCode, 1);
  } finally {
    try {
      finalExitCode = await finalizeOnce(finalExitCode);
    } finally {
      removeShutdownHandlers();
    }
  }

  return finalExitCode;
}

async function checkConfiguration({ report }) {
  report.addSection('Configuration');

  const result = loadValidatedConfig({
    applyToProcessEnv: true,
    overrideProcessEnv: true,
    projectRoot,
  });

  if (result.code === 'CONFIG_ENV_FILE_MISSING') {
    report.add('Configuration', 'ERROR', '.env file not found');
    throw new Error(result.message);
  }

  report.add('Configuration', 'OK', '.env found');

  if (!result.ok) {
    for (const error of result.details?.errors ?? []) {
      report.add('Configuration', 'ERROR', `${error.variable}: ${error.message}`);
    }

    throw new Error('Configuration is invalid.');
  }

  for (const warning of result.details.warnings) {
    report.add('Configuration', 'WARN', `${warning.variable}: ${warning.message}`);
  }

  report.add('Configuration', 'OK', 'Configuration valid');

  return {
    config: result.details.config,
    doctorEnv: {
      POSTGRES_SERVICE_NAME: process.env.POSTGRES_SERVICE_NAME,
    },
  };
}

function loadBackendDependencies() {
  const backendRequire = createRequire(resolve(projectRoot, 'backend/package.json'));
  const { Client: PgClient } = backendRequire('pg');
  const {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
  } = backendRequire('@aws-sdk/client-s3');

  return {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PgClient,
    PutObjectCommand,
    S3Client,
  };
}

export function installShutdownHandlers({
  finalizeOnce,
  processImpl = process,
  setInterrupted,
}) {
  let shutdownRequested = false;

  const completeFinalization = (finalizePromise) => {
    void finalizePromise.then(
      (exitCode) => {
        processImpl.exitCode = exitCode;
      },
      () => {
        processImpl.exitCode = 2;
      },
    );
  };

  const beginShutdown = (exitCode, error = null) => {
    if (shutdownRequested) {
      return;
    }

    shutdownRequested = true;
    setInterrupted();
    completeFinalization(finalizeOnce(exitCode, error));
  };

  const handleSignal = (signal) => {
    beginShutdown(signal === 'SIGINT' ? 130 : 143);
  };

  const handleSigint = () => handleSignal('SIGINT');
  const handleSigterm = () => handleSignal('SIGTERM');

  const handleUncaughtException = (error) => {
    beginShutdown(1, error);
  };

  const handleUnhandledRejection = (reason) => {
    beginShutdown(1, reason);
  };

  processImpl.on('SIGINT', handleSigint);
  processImpl.on('SIGTERM', handleSigterm);
  processImpl.on('uncaughtException', handleUncaughtException);
  processImpl.on('unhandledRejection', handleUnhandledRejection);

  return () => {
    processImpl.removeListener('SIGINT', handleSigint);
    processImpl.removeListener('SIGTERM', handleSigterm);
    processImpl.removeListener('uncaughtException', handleUncaughtException);
    processImpl.removeListener('unhandledRejection', handleUnhandledRejection);
  };
}

function createFinalizer({ cleanupOnce, initialEnv, report }) {
  let finalizePromise = null;
  let requestedExitCode = 0;

  return function finalizeOnce(exitCode, error = null) {
    requestedExitCode = Math.max(requestedExitCode, exitCode);

    if (error) {
      report.add('Project', 'ERROR', formatError(error));
    }

    finalizePromise ??= finalize({
      cleanupOnce,
      getRequestedExitCode: () => requestedExitCode,
      initialEnv,
      report,
    });

    return finalizePromise;
  };
}

async function finalize({
  cleanupOnce,
  getRequestedExitCode,
  initialEnv,
  report,
}) {
  let cleanupErrors = 0;

  try {
    const cleanup = await cleanupOnce();
    cleanupErrors += cleanup.cleanupErrors;
  } catch (error) {
    cleanupErrors += 1;
    report.add('Project', 'ERROR', `Cleanup failed: ${formatError(error)}`);
  }

  cleanupErrors += restoreProcessEnv(initialEnv);

  const finalExitCode =
    cleanupErrors > 0
      ? 2
      : Math.max(getRequestedExitCode(), report.errorCount > 0 ? 1 : 0);

  report.add(
    'Project',
    cleanupErrors === 0 ? 'OK' : 'ERROR',
    `Initial state restored: ${cleanupErrors === 0 ? 'yes' : 'no'}`,
  );
  report.print();

  return finalExitCode;
}

function snapshotProcessEnv() {
  return { ...process.env };
}

function restoreProcessEnv(snapshot) {
  try {
    for (const key of Object.keys(process.env)) {
      if (!Object.hasOwn(snapshot, key)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(snapshot)) {
      process.env[key] = value;
    }

    return 0;
  } catch {
    return 1;
  }
}
