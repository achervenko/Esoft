import {
  checkPostgresConnection as checkPostgresConnectionOperation,
  waitForPostgres as waitForPostgresOperation,
} from '../infrastructure/postgres/connection.mjs';
import { terminatePgClient } from '../infrastructure/postgres/pg-client-terminator.mjs';
import {
  getPostgresServiceState as getPostgresServiceStateOperation,
  startPostgresService as startPostgresServiceOperation,
  stopPostgresService,
} from '../infrastructure/postgres/service.mjs';
import { checkPrismaMigrationStatus } from '../infrastructure/prisma/migrations.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import {
  beginStartupOperation,
  notifyCleanupStateChanged,
} from './resource-registry.mjs';
import { compactOutput, delay, normalizeOptionalEnv } from './utils.mjs';

export async function checkPostgres({
  config,
  cleanupState,
  env,
  isShuttingDown = () => false,
  managedServices,
  npm,
  PgClient,
  platform = process.platform,
  projectRoot,
  report,
  runCaptured,
}) {
  report.addSection('PostgreSQL');

  const serviceName = normalizeOptionalEnv(env.POSTGRES_SERVICE_NAME);
  const serviceState = await getPostgresServiceState(serviceName, {
    platform,
    runCaptured,
  });
  let serviceStartRequested = false;

  if (serviceState.available) {
    report.add('PostgreSQL', 'OK', `Windows service state: ${serviceState.state}`);
  } else if (serviceName) {
    report.add('PostgreSQL', 'WARN', serviceState.message);
  }

  if (serviceState.state === 'STOPPED') {
    const started = await startPostgresService(serviceName, {
      managedServices,
      cleanupState,
      isShuttingDown,
      platform,
      report,
      runCaptured,
    });

    if (!started.ok) {
      return { dependencyOk: false, ok: false };
    }

    serviceStartRequested = started.startRequested;
  }

  const shouldWaitForConnection =
    serviceStartRequested || serviceState.state === 'START_PENDING';
  const connection = await waitForPostgres({
    allowRetry: shouldWaitForConnection,
    checkConnection: ({ signal } = {}) =>
      checkPostgresConnection({ config, PgClient, signal }),
    timeoutMs: shouldWaitForConnection ? 30_000 : undefined,
  });

  if (!connection.ok) {
    report.add('PostgreSQL', 'ERROR', `Database connection: ${connection.message}`);

    if (
      !serviceName &&
      serviceState.code !== 'POSTGRES_SERVICE_OPERATION_UNAVAILABLE'
    ) {
      report.add(
        'PostgreSQL',
        'ERROR',
        'POSTGRES_SERVICE_NAME is required to check or start Windows service',
      );
    }

    return { dependencyOk: false, ok: false };
  }

  if (serviceStartRequested) {
    report.add('PostgreSQL', 'STARTED', 'Windows service started temporarily');
  }

  report.add('PostgreSQL', 'OK', 'Database connection');
  report.add('PostgreSQL', 'OK', 'SELECT 1');

  const migration = await checkMigrations({
    npm,
    projectRoot,
    report,
    runCaptured,
  });
  return { dependencyOk: true, ok: migration.ok };
}

export async function getPostgresServiceState(
  serviceName,
  { platform = process.platform, runCaptured },
) {
  const result = await getPostgresServiceStateOperation(serviceName, {
    platform,
    runCommand: runCaptured,
  });

  return {
    available: result.ok,
    code: result.code,
    message: result.ok ? null : result.message,
    state: result.details?.state ?? null,
  };
}

export async function startPostgresService(
  serviceName,
  {
    cleanupState,
    isShuttingDown = () => false,
    managedServices,
    platform = process.platform,
    report,
    runCaptured,
  },
) {
  let finishStartup = () => undefined;

  try {
    finishStartup = beginStartupOperation(cleanupState);

    if (!serviceName) {
      report.add('PostgreSQL', 'ERROR', 'PostgreSQL is stopped');
      report.add(
        'PostgreSQL',
        'ERROR',
        'POSTGRES_SERVICE_NAME is required to start Windows service',
      );
      return { ok: false, startRequested: false };
    }

    if (isShuttingDown()) {
      return { ok: false, startRequested: false };
    }

    const result = await startPostgresServiceOperation(serviceName, {
      platform,
      runCommand: runCaptured,
    });

    if (!result.ok) {
      report.add('PostgreSQL', 'ERROR', 'PostgreSQL is stopped');
      report.add(
        'PostgreSQL',
        'ERROR',
        result.code === 'POSTGRES_SERVICE_START_ACCESS_DENIED'
          ? 'Unable to start Windows service without administrator privileges'
          : `${result.message}: ${
              result.details?.stderr || result.details?.stdout || '<empty output>'
            }`,
      );
      return { ok: false, startRequested: false };
    }

    const service = { name: 'PostgreSQL', serviceName };

    if (
      !registerManagedService(
        managedServices,
        service,
        isShuttingDown,
        cleanupState,
      )
    ) {
      let stopError;
      let stopped = false;
      const stopRunCaptured = async (...args) => {
        try {
          return await runCaptured(...args);
        } catch (error) {
          stopError = error;
          throw error;
        }
      };

      try {
        stopped = await stopManagedService(service, {
          getServiceState: (currentServiceName) =>
            getPostgresServiceState(currentServiceName, {
              platform,
              runCaptured: stopRunCaptured,
            }),
          platform,
          runCaptured: stopRunCaptured,
        });
      } catch (error) {
        stopError ??= error;
      }

      if (!stopped) {
        managedServices.push(service);
        notifyCleanupStateChanged(cleanupState);

        if (stopError !== undefined) {
          report.add(
            'PostgreSQL',
            'ERROR',
            `Initial service state restoration failed: ${formatError(stopError)}`,
          );
        }

        report.add('PostgreSQL', 'ERROR', 'Initial service state was not restored');
      }

      return { ok: false, startRequested: false };
    }

    report.add('PostgreSQL', 'INFO', 'Windows service start requested');
    return { ok: true, startRequested: true };
  } finally {
    finishStartup();
  }
}

export async function waitForPostgres({ allowRetry, checkConnection, timeoutMs }) {
  if (!allowRetry) {
    return checkConnection();
  }

  return waitForPostgresOperation({
    checkConnection,
    intervalMs: 1_000,
    timeoutMs,
  });
}

export async function checkPostgresConnection({ config, PgClient, signal }) {
  return checkPostgresConnectionOperation({
    config,
    PgClient,
    signal,
    terminateClient: terminatePgClient,
  });
}

export async function checkMigrations({ npm, projectRoot, report, runCaptured }) {
  const result = await checkPrismaMigrationStatus({
    npm,
    projectRoot,
    runCommand: runCaptured,
  });

  if (result.ok) {
    report.add('PostgreSQL', 'OK', 'Migrations applied');
    return { ok: true };
  }

  report.add(
    'PostgreSQL',
    'ERROR',
    `${formatMigrationMessage(result)}: ${compactOutput(
      result.details?.stderr || result.details?.stdout || '<empty output>',
    )}`,
  );
  return { ok: false };
}

export async function stopManagedService(
  service,
  {
    getServiceState,
    intervalMs = 1_000,
    platform = process.platform,
    runCaptured,
    timeoutMs = 30_000,
  },
) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  const result = await stopPostgresService(service.serviceName, {
    platform,
    runCommand: runCaptured,
  });

  if (!result.ok) {
    return false;
  }

  const startedAt = Date.now();

  while (true) {
    const state = await getServiceState(service.serviceName);

    if (state.state === 'STOPPED') {
      return true;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return false;
    }

    await delay(Math.min(intervalMs, remainingMs));
  }
}

function formatMigrationMessage(result) {
  const migrationMessages = {
    PRISMA_MIGRATIONS_DIVERGED: 'Migration history has diverged',
    PRISMA_MIGRATIONS_FAILED: 'Failed migrations detected',
    PRISMA_MIGRATIONS_PENDING: 'Pending migrations detected',
  };

  return migrationMessages[result.code] ?? result.message;
}

function registerManagedService(
  managedServices,
  service,
  isShuttingDown,
  cleanupState,
) {
  if (isShuttingDown()) {
    return false;
  }

  managedServices.push(service);
  notifyCleanupStateChanged(cleanupState);

  if (!isShuttingDown()) {
    return true;
  }

  removeManagedService(managedServices, service);
  notifyCleanupStateChanged(cleanupState);
  return false;
}

function removeManagedService(managedServices, service) {
  const index = managedServices.indexOf(service);

  if (index !== -1) {
    managedServices.splice(index, 1);
  }
}
