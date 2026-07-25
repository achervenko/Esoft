import { npmArgs } from '../process/run-parallel.mjs';
import { compactOutput, delay, formatError, normalizeOptionalEnv } from './utils.mjs';

export async function checkPostgres({
  config,
  env,
  managedServices,
  npm,
  PgClient,
  projectRoot,
  report,
  runCaptured,
}) {
  report.addSection('PostgreSQL');

  const serviceName = normalizeOptionalEnv(env.POSTGRES_SERVICE_NAME);
  const serviceState = await getPostgresServiceState(serviceName, { runCaptured });

  if (serviceState.available) {
    report.add('PostgreSQL', 'OK', `Windows service state: ${serviceState.state}`);
  } else if (serviceName) {
    report.add('PostgreSQL', 'WARN', serviceState.message);
  }

  if (serviceState.state === 'STOPPED') {
    const started = await startPostgresService(serviceName, {
      managedServices,
      report,
      runCaptured,
    });

    if (!started) {
      return { dependencyOk: false, ok: false };
    }
  }

  const connection = await waitForPostgres({
    allowRetry: serviceState.state === 'STOPPED',
    checkConnection: () => checkPostgresConnection({ config, PgClient }),
    timeoutMs: serviceState.state === 'STOPPED' ? 30_000 : 1,
  });

  if (!connection.ok) {
    report.add('PostgreSQL', 'ERROR', `Database connection: ${connection.message}`);

    if (!serviceName) {
      report.add(
        'PostgreSQL',
        'ERROR',
        'POSTGRES_SERVICE_NAME is required to check or start Windows service',
      );
    }

    return { dependencyOk: false, ok: false };
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

export async function getPostgresServiceState(serviceName, { runCaptured }) {
  if (process.platform !== 'win32') {
    return {
      available: false,
      message: 'Windows service checks are unavailable on this platform',
      state: null,
    };
  }

  if (!serviceName) {
    return {
      available: false,
      message: 'POSTGRES_SERVICE_NAME is not set',
      state: null,
    };
  }

  const result = await runCaptured('sc.exe', ['query', serviceName], {
    timeoutMs: 10_000,
  });

  if (result.code !== 0) {
    return {
      available: false,
      message: `Windows service ${serviceName} was not found or cannot be queried`,
      state: null,
    };
  }

  const stateMatch = result.stdout.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/);

  return {
    available: Boolean(stateMatch),
    message: stateMatch
      ? null
      : `Unable to parse Windows service state for ${serviceName}`,
    state: stateMatch?.[1] ?? null,
  };
}

export async function startPostgresService(
  serviceName,
  { managedServices, report, runCaptured },
) {
  if (!serviceName) {
    report.add('PostgreSQL', 'ERROR', 'PostgreSQL is stopped');
    report.add(
      'PostgreSQL',
      'ERROR',
      'POSTGRES_SERVICE_NAME is required to start Windows service',
    );
    return false;
  }

  const result = await runCaptured('sc.exe', ['start', serviceName], {
    timeoutMs: 20_000,
  });

  if (result.code !== 0) {
    report.add('PostgreSQL', 'ERROR', 'PostgreSQL is stopped');
    report.add(
      'PostgreSQL',
      'ERROR',
      isWindowsAccessDenied(result)
        ? 'Unable to start Windows service without administrator privileges'
        : `Unable to start Windows service ${serviceName}: ${result.stderr || result.stdout}`,
    );
    return false;
  }

  managedServices.push({ name: 'PostgreSQL', serviceName });
  report.add('PostgreSQL', 'STARTED', 'Windows service started temporarily');
  return true;
}

export async function waitForPostgres({ allowRetry, checkConnection, timeoutMs }) {
  const startedAt = Date.now();
  let lastError = null;

  do {
    const result = await checkConnection();

    if (result.ok) {
      return result;
    }

    lastError = result.message;

    if (!allowRetry) {
      break;
    }

    await delay(1_000);
  } while (Date.now() - startedAt < timeoutMs);

  return { message: lastError ?? 'connection failed', ok: false };
}

export async function checkPostgresConnection({ config, PgClient }) {
  const client = new PgClient({
    connectionString: config.database.url,
    connectionTimeoutMillis: 3_000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { message: formatError(error), ok: false };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function checkMigrations({ npm, projectRoot, report, runCaptured }) {
  const result = await runCaptured(
    npm,
    npmArgs([
      'exec',
      '--workspace',
      'backend',
      '--',
      'prisma',
      'migrate',
      'status',
    ]),
    {
      cwd: projectRoot,
      timeoutMs: 30_000,
    },
  );

  if (result.code === 0) {
    report.add('PostgreSQL', 'OK', 'Migrations applied');
    return { ok: true };
  }

  report.add(
    'PostgreSQL',
    'ERROR',
    `Migration status failed: ${compactOutput(result.stderr || result.stdout)}`,
  );
  return { ok: false };
}

export async function stopManagedService(service, { getServiceState, runCaptured }) {
  const result = await runCaptured('sc.exe', ['stop', service.serviceName], {
    timeoutMs: 20_000,
  });

  if (result.code !== 0) {
    return false;
  }

  const startedAt = Date.now();

  do {
    const state = await getServiceState(service.serviceName);

    if (state.state === 'STOPPED') {
      return true;
    }

    await delay(1_000);
  } while (Date.now() - startedAt < 30_000);

  return false;
}

export function isWindowsAccessDenied(result) {
  const output = `${result.stdout}\n${result.stderr}`;
  return output.includes('Access is denied') || output.includes('Отказано в доступе');
}
