import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { npmCommandName } from '../infrastructure/commands/npm-command.mjs';
import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { loadValidatedConfig } from '../infrastructure/config/validated-config.mjs';
import { createResourceRegistry } from '../infrastructure/resources/resource-registry.mjs';
import { runInfrastructureSetup } from '../infrastructure/setup/setup.mjs';
import { failure } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import { createSetupReport } from './report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const backendRequire = createRequire(resolve(projectRoot, 'backend/package.json'));

export async function runSetup() {
  const report = createSetupReport();
  const resources = createResourceRegistry();
  let interrupted = false;
  let interruptedExitCode = 1;
  let fatalError = null;
  const finalizeOnce = createFinalizer({ resources });
  const removeShutdownHandlers = installSetupShutdownHandlers({
    finalizeOnce,
    processImpl: process,
    setInterrupted: (error = null, exitCode = 1) => {
      interrupted = true;
      interruptedExitCode = exitCode;
      fatalError ??= error;
    },
  });

  try {
    const npm = npmCommandName();
    const configuration = loadValidatedConfig({
      applyToProcessEnv: true,
      overrideProcessEnv: true,
      projectRoot,
    });
    report.addStep('Configuration', configuration);

    if (!configuration.ok) {
      report.print();
      return 1;
    }

    const setup = await runInfrastructureSetup({
      ...loadRuntimeDependencies(),
      config: configuration.details.config,
      isShuttingDown: () => interrupted,
      npm,
      onStep: (label, result) => {
        report.addStep(label, result);
      },
      projectRoot,
      resources,
      runCommand,
    });

    if (fatalError) {
      report.addStep(
        'Setup',
        failure('SETUP_INTERRUPTED', 'Setup was interrupted', {
          error: formatError(fatalError),
        }),
      );
    }

    report.print();
    return exitCodeForSetupResult(setup, {
      interrupted,
      interruptedExitCode,
    });
  } catch (error) {
    const cleanupExitCode = await finalizeOnce(1);

    report.addStep(
      'Setup',
      failure('SETUP_UNEXPECTED_ERROR', 'An unexpected setup error occurred', {
        error: formatError(error),
      }),
    );
    report.print();
    return cleanupExitCode;
  } finally {
    removeShutdownHandlers();
  }
}

function loadRuntimeDependencies() {
  const { Client: PgClient } = backendRequire('pg');
  const {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
  } = backendRequire('@aws-sdk/client-s3');

  return {
    commands: {
      CreateBucketCommand,
      DeleteObjectCommand,
      GetObjectCommand,
      HeadBucketCommand,
      PutObjectCommand,
    },
    PgClient,
    S3Client,
  };
}

export function installSetupShutdownHandlers({
  finalizeOnce,
  processImpl = process,
  setInterrupted,
}) {
  let shutdownRequested = false;

  const beginShutdown = (exitCode, error = null) => {
    if (shutdownRequested) {
      return;
    }

    shutdownRequested = true;
    setInterrupted(error, exitCode);
    void finalizeOnce(exitCode).then(
      (finalExitCode) => {
        processImpl.exitCode = finalExitCode;
      },
      () => {
        processImpl.exitCode = 2;
      },
    );
  };

  const handleSigint = () => beginShutdown(130);
  const handleSigterm = () => beginShutdown(143);
  const handleUncaughtException = (error) => beginShutdown(1, error);
  const handleUnhandledRejection = (reason) => beginShutdown(1, reason);

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

function createFinalizer({ resources }) {
  let finalizePromise = null;
  let requestedExitCode = 0;

  return function finalizeOnce(exitCode) {
    requestedExitCode = Math.max(requestedExitCode, exitCode);

    finalizePromise ??= resources.cleanup().then(
      (cleanup) => (cleanup.ok ? requestedExitCode : 2),
      () => 2,
    );

    return finalizePromise;
  };
}

function exitCodeForSetupResult(result, { interrupted, interruptedExitCode }) {
  if (result.code === 'SETUP_CLEANUP_FAILED') {
    return 2;
  }

  if (interrupted) {
    return interruptedExitCode;
  }

  return result.ok ? 0 : 1;
}
