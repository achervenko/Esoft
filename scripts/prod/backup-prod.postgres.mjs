import { stat } from 'node:fs/promises';

import { failure, success } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

const PG_DUMP_TIMEOUT_MS = 10 * 60_000;

export async function checkPgDumpAvailable({ config, runCommand }) {
  const pgDump = resolvePgDumpExecutable(config);
  let commandResult;

  try {
    commandResult = await runCommand(pgDump, ['--version'], {
      timeoutMs: 10_000,
    });
  } catch (error) {
    return failure('PG_DUMP_UNAVAILABLE', 'pg_dump is unavailable', {
      command: pgDump,
      error: formatError(error),
    });
  }

  if (!commandResult.ok) {
    return failure('PG_DUMP_UNAVAILABLE', 'pg_dump is unavailable', {
      code: commandResult.code,
      command: pgDump,
      signal: commandResult.signal,
      stderr: redactSensitiveText(commandResult.stderr ?? ''),
      stdout: redactSensitiveText(commandResult.stdout ?? ''),
      timedOut: Boolean(commandResult.timedOut),
    });
  }

  return success('PG_DUMP_AVAILABLE', 'pg_dump is available', {
    command: pgDump,
    version: redactSensitiveText(commandResult.stdout || commandResult.stderr),
  });
}

export async function backupPostgresDatabase({
  config,
  dumpPath,
  runCommand,
}) {
  const pgDump = resolvePgDumpExecutable(config);
  const connection = parsePostgresConnection(config.database.url);

  if (!connection.ok) {
    return connection;
  }

  const pgDumpEnv = {
    ...process.env,
    PGDATABASE: connection.details.database,
    PGHOST: connection.details.host,
    PGPASSWORD: connection.details.password,
    PGPORT: connection.details.port,
    PGUSER: connection.details.user,
  };

  if (connection.details.sslmode) {
    pgDumpEnv.PGSSLMODE = connection.details.sslmode;
  }

  let commandResult;

  try {
    commandResult = await runCommand(pgDump, [
      '--format=custom',
      `--file=${dumpPath}`,
    ], {
      env: pgDumpEnv,
      timeoutMs: PG_DUMP_TIMEOUT_MS,
    });
  } catch (error) {
    return failure('POSTGRES_BACKUP_FAILED', 'PostgreSQL backup failed', {
      error: formatError(error),
    });
  }

  if (!commandResult.ok) {
    return failure('POSTGRES_BACKUP_FAILED', 'PostgreSQL backup failed', {
      code: commandResult.code,
      signal: commandResult.signal,
      stderr: redactSensitiveText(commandResult.stderr ?? ''),
      stdout: redactSensitiveText(commandResult.stdout ?? ''),
      timedOut: Boolean(commandResult.timedOut),
    });
  }

  return success('POSTGRES_BACKUP_OK', 'PostgreSQL backup completed', {
    file: 'database.dump',
  });
}

export async function verifyDatabaseDump({ dumpPath }) {
  try {
    const dumpStat = await stat(dumpPath);

    if (!dumpStat.isFile()) {
      return failure('POSTGRES_BACKUP_MISSING', 'database.dump is not a file', {
        path: dumpPath,
      });
    }

    if (dumpStat.size <= 0) {
      return failure('POSTGRES_BACKUP_MISSING', 'database.dump is empty', {
        path: dumpPath,
      });
    }

    return success('POSTGRES_BACKUP_VERIFIED', 'database.dump is valid', {
      file: 'database.dump',
      sizeBytes: dumpStat.size,
    });
  } catch (error) {
    return failure('POSTGRES_BACKUP_MISSING', 'database.dump is missing', {
      error: formatError(error),
      path: dumpPath,
    });
  }
}

function resolvePgDumpExecutable(config) {
  return config.backup?.pgDumpPath || 'pg_dump';
}

function parsePostgresConnection(databaseUrl) {
  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    return failure('POSTGRES_BACKUP_FAILED', 'DATABASE_URL is invalid');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!url.hostname || !url.username || !database) {
    return failure('POSTGRES_BACKUP_FAILED', 'DATABASE_URL is incomplete');
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
