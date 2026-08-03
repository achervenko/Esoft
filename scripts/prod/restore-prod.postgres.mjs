import { checkPostgresConnection } from '../infrastructure/postgres/connection.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

const PG_RESTORE_TIMEOUT_MS = 10 * 60_000;

export async function checkPgRestoreAvailable({ config, runCommand }) {
  const pgRestore = resolvePgRestoreExecutable(config);
  let commandResult;

  try {
    commandResult = await runCommand(pgRestore, ['--version'], {
      timeoutMs: 10_000,
    });
  } catch (error) {
    return failure('PG_RESTORE_UNAVAILABLE', 'pg_restore is unavailable', {
      command: pgRestore,
      error: formatError(error),
    });
  }

  if (!commandResult.ok) {
    return failure('PG_RESTORE_UNAVAILABLE', 'pg_restore is unavailable', {
      code: commandResult.code,
      command: pgRestore,
      signal: commandResult.signal,
      stderr: redactSensitiveText(commandResult.stderr ?? ''),
      stdout: redactSensitiveText(commandResult.stdout ?? ''),
      timedOut: Boolean(commandResult.timedOut),
    });
  }

  return success('PG_RESTORE_AVAILABLE', 'pg_restore is available', {
    command: pgRestore,
    version: redactSensitiveText(commandResult.stdout || commandResult.stderr),
  });
}

export async function checkProductionPostgres({ config, PgClient }) {
  return checkPostgresConnection({
    config,
    PgClient,
  });
}

export async function restorePostgresDatabase({
  config,
  dumpPath,
  runCommand,
}) {
  const pgRestore = resolvePgRestoreExecutable(config);
  const connection = parsePostgresConnection(config.database.url);

  if (!connection.ok) {
    return connection;
  }

  const pgRestoreEnv = {
    ...process.env,
    PGDATABASE: connection.details.database,
    PGHOST: connection.details.host,
    PGPASSWORD: connection.details.password,
    PGPORT: connection.details.port,
    PGUSER: connection.details.user,
  };

  if (connection.details.sslmode) {
    pgRestoreEnv.PGSSLMODE = connection.details.sslmode;
  }

  let commandResult;

  try {
    commandResult = await runCommand(pgRestore, [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--single-transaction',
      `--dbname=${connection.details.database}`,
      dumpPath,
    ], {
      env: pgRestoreEnv,
      timeoutMs: PG_RESTORE_TIMEOUT_MS,
    });
  } catch (error) {
    return failure('POSTGRES_RESTORE_FAILED', 'PostgreSQL restore failed', {
      error: formatError(error),
    });
  }

  if (!commandResult.ok) {
    return failure('POSTGRES_RESTORE_FAILED', 'PostgreSQL restore failed', {
      code: commandResult.code,
      signal: commandResult.signal,
      stderr: redactSensitiveText(commandResult.stderr ?? ''),
      stdout: redactSensitiveText(commandResult.stdout ?? ''),
      timedOut: Boolean(commandResult.timedOut),
    });
  }

  return success('POSTGRES_RESTORE_OK', 'PostgreSQL restore completed', {
    file: 'database.dump',
  });
}

function resolvePgRestoreExecutable(config) {
  return config.backup?.pgRestorePath || 'pg_restore';
}

function parsePostgresConnection(databaseUrl) {
  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    return failure('POSTGRES_RESTORE_FAILED', 'DATABASE_URL is invalid');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!url.hostname || !url.username || !database) {
    return failure('POSTGRES_RESTORE_FAILED', 'DATABASE_URL is incomplete');
  }

  return success('POSTGRES_CONNECTION_PARSED', 'DATABASE_URL parsed', {
    database,
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port || '5432',
    sslmode: url.searchParams.get('sslmode'),
    user: decodeURIComponent(url.username),
  });
}
