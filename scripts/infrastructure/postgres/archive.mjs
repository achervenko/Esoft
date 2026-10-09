import { failure, success } from '../result.mjs';
import { formatError, redactSensitiveText } from '../security/redaction.mjs';

export async function verifyPostgresArchive({ config, dumpPath, runCommand }) {
  try {
    const result = await runCommand(
      config.backup?.pgRestorePath || 'pg_restore',
      ['--list', dumpPath],
      { timeoutMs: 30_000 },
    );

    if (!result.ok) {
      return failure('POSTGRES_ARCHIVE_UNREADABLE', 'PostgreSQL archive table of contents is unreadable', {
        code: result.code,
        signal: result.signal,
        timedOut: Boolean(result.timedOut),
        stderr: redactSensitiveText(result.stderr ?? ''),
      });
    }

    return success('POSTGRES_ARCHIVE_READABLE', 'PostgreSQL archive table of contents is readable');
  } catch (error) {
    return failure('POSTGRES_ARCHIVE_UNREADABLE', 'Unable to read PostgreSQL archive table of contents', {
      error: formatError(error),
    });
  }
}
