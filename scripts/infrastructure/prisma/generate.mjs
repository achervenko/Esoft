import { npmArgs } from '../commands/npm-command.mjs';
import { failure, success } from '../result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../security/redaction.mjs';

export async function generatePrismaClient({
  npm,
  projectRoot,
  runCommand,
  timeoutMs = 60_000,
}) {
  let result;

  try {
    result = await runCommand(npm, npmArgs(['run', 'db:generate']), {
      cwd: projectRoot,
      timeoutMs,
    });
  } catch (error) {
    return failure(
      'PRISMA_CLIENT_GENERATION_FAILED',
      'Unable to generate Prisma Client',
      {
        error: formatError(error),
      },
    );
  }

  if (result.ok) {
    return success('PRISMA_CLIENT_GENERATED', 'Prisma Client generated');
  }

  return failure(
    'PRISMA_CLIENT_GENERATION_FAILED',
    'Unable to generate Prisma Client',
    {
      code: result.code,
      stderr: redactSensitiveText(result.stderr),
      stdout: redactSensitiveText(result.stdout),
      timedOut: result.timedOut,
    },
  );
}
