import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { npmCommandName, npmScriptArgs } from '../process/run-parallel.mjs';
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
const backendRequire = createRequire(resolve(projectRoot, 'backend/package.json'));
const configCore = createRequire(import.meta.url)('../config/config-core.cjs');

const { Client: PgClient } = backendRequire('pg');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} = backendRequire('@aws-sdk/client-s3');

export async function runDoctor() {
  const npm = npmCommandName();
  const managedProcesses = [];
  const managedServices = [];
  const cleanupState = { started: false };
  const report = createReport();
  let config = null;
  let env = null;
  let finalExitCode = 0;
  let interrupted = false;

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
      isShuttingDown: () => cleanupState.started || interrupted,
      managedProcesses,
      projectRoot,
      report,
      ...options,
    });

  installShutdownHandlers({
    cleanupOnce,
    report,
    setInterrupted: () => {
      interrupted = true;
    },
  });

  try {
    ({ config, env } = await checkConfiguration({ report }));

    const postgres = await checkPostgres({
      config,
      env,
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
    const cleanup = await cleanupOnce();

    if (cleanup.cleanupErrors > 0) {
      finalExitCode = 2;
    } else if (report.errorCount > 0) {
      finalExitCode = Math.max(finalExitCode, 1);
    }

    report.add(
      'Project',
      cleanup.cleanupErrors === 0 ? 'OK' : 'ERROR',
      `Initial state restored: ${cleanup.cleanupErrors === 0 ? 'yes' : 'no'}`,
    );
    report.print();
  }

  return interrupted && finalExitCode === 0 ? 0 : finalExitCode;
}

async function checkConfiguration({ report }) {
  report.addSection('Configuration');

  const loadedEnvironment = configCore.loadEnvironment({
    applyToProcessEnv: true,
    overrideProcessEnv: true,
    projectRoot,
  });
  report.add('Configuration', 'OK', '.env found');

  const validation = configCore.validateEnvironment(loadedEnvironment.env);
  if (!validation.valid) {
    for (const error of validation.errors) {
      report.add('Configuration', 'ERROR', `${error.variable}: ${error.message}`);
    }

    throw new Error('Configuration is invalid.');
  }

  for (const warning of validation.warnings) {
    report.add('Configuration', 'WARN', `${warning.variable}: ${warning.message}`);
  }

  report.add('Configuration', 'OK', 'Configuration valid');

  return {
    config: configCore.buildConfig(loadedEnvironment.env),
    env: loadedEnvironment.env,
  };
}

function installShutdownHandlers({ cleanupOnce, report, setInterrupted }) {
  const handleSignal = () => {
    setInterrupted();
    void cleanupOnce().then((cleanup) => {
      process.exit(cleanup.cleanupErrors > 0 ? 2 : 0);
    });
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  process.once('uncaughtException', (error) => {
    report.add('Project', 'ERROR', formatError(error));
    void cleanupOnce().then((cleanup) => {
      process.exit(cleanup.cleanupErrors > 0 ? 2 : 1);
    });
  });

  process.once('unhandledRejection', (reason) => {
    report.add('Project', 'ERROR', formatError(reason));
    void cleanupOnce().then((cleanup) => {
      process.exit(cleanup.cleanupErrors > 0 ? 2 : 1);
    });
  });
}
