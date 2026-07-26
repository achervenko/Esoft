import { npmArgs } from '../commands/npm-command.mjs';
import { failure, success } from '../result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../security/redaction.mjs';

export async function seedDatabase({
  npm,
  projectRoot,
  runCommand,
  timeoutMs = 120_000,
}) {
  let result;

  try {
    result = await runCommand(npm, npmArgs(['run', 'db:seed']), {
      cwd: projectRoot,
      timeoutMs,
    });
  } catch (error) {
    return failure('PRISMA_SEED_FAILED', 'Database seed failed', {
      error: formatError(error),
    });
  }

  if (result.ok) {
    return success('PRISMA_SEED_OK', 'Database seed completed');
  }

  return failure('PRISMA_SEED_FAILED', 'Database seed failed', {
    code: result.code,
    stderr: redactSensitiveText(result.stderr),
    stdout: redactSensitiveText(result.stdout),
    timedOut: result.timedOut,
  });
}
