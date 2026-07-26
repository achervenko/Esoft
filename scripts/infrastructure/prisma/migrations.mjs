import { npmArgs } from '../commands/npm-command.mjs';
import { failure, success } from '../result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../security/redaction.mjs';

export async function checkPrismaMigrationStatus({
  npm,
  projectRoot,
  runCommand,
  timeoutMs = 30_000,
}) {
  let result;

  try {
    result = await runCommand(
      npm,
      npmArgs(['run', 'db:migrate:status']),
      {
        cwd: projectRoot,
        timeoutMs,
      },
    );
  } catch (error) {
    return failure(
      'PRISMA_MIGRATION_STATUS_FAILED',
      'Unable to determine Prisma migration status',
      {
        error: formatError(error),
      },
    );
  }

  if (result.ok) {
    return success(
      'PRISMA_MIGRATIONS_APPLIED',
      'Prisma migrations are applied',
    );
  }

  if (result.timedOut) {
    return failure(
      'PRISMA_MIGRATION_STATUS_FAILED',
      'Unable to determine Prisma migration status',
      commandFailureDetails(result),
    );
  }

  const classification = classifyMigrationStatus(result);

  return failure(
    classification.code,
    classification.message,
    commandFailureDetails(result),
  );
}

export async function deployPrismaMigrations({
  npm,
  projectRoot,
  runCommand,
  timeoutMs = 120_000,
}) {
  let result;

  try {
    result = await runCommand(
      npm,
      npmArgs(['run', 'db:migrate:deploy']),
      {
        cwd: projectRoot,
        timeoutMs,
      },
    );
  } catch (error) {
    return failure(
      'PRISMA_MIGRATION_DEPLOY_FAILED',
      'Unable to deploy Prisma migrations',
      {
        error: formatError(error),
      },
    );
  }

  if (result.ok) {
    return success(
      'PRISMA_MIGRATIONS_DEPLOYED',
      'Prisma migrations deployed',
    );
  }

  return failure(
    'PRISMA_MIGRATION_DEPLOY_FAILED',
    'Unable to deploy Prisma migrations',
    commandFailureDetails(result),
  );
}

function classifyMigrationStatus(result) {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (
    output.includes('failed migration') ||
    output.includes('failed migrations')
  ) {
    return {
      code: 'PRISMA_MIGRATIONS_FAILED',
      message: 'Prisma has failed migrations',
    };
  }

  if (
    output.includes('migration history') &&
    output.includes('different')
  ) {
    return {
      code: 'PRISMA_MIGRATIONS_DIVERGED',
      message: 'Prisma migration history has diverged',
    };
  }

  if (
    output.includes('modified since it was applied') ||
    output.includes('modified since they were applied')
  ) {
    return {
      code: 'PRISMA_MIGRATIONS_DIVERGED',
      message: 'Prisma migration history has diverged',
    };
  }

  if (output.includes('have not yet been applied')) {
    return {
      code: 'PRISMA_MIGRATIONS_PENDING',
      message: 'Prisma migrations are pending',
    };
  }

  return {
    code: 'PRISMA_MIGRATION_STATUS_FAILED',
    message: 'Unable to determine Prisma migration status',
  };
}

function commandFailureDetails(result) {
  return {
    code: result.code,
    stderr: redactSensitiveText(result.stderr),
    stdout: redactSensitiveText(result.stdout),
    timedOut: result.timedOut,
  };
}
