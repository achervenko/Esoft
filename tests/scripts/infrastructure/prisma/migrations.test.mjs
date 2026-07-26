import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkPrismaMigrationStatus,
  deployPrismaMigrations,
} from '../../../../scripts/infrastructure/prisma/migrations.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

test('checkPrismaMigrationStatus calls the root migration status script', async () => {
  const calls = [];

  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
    timeoutMs: 123,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_APPLIED');
  assert.equal(calls.length, 1);

  const [command, args, options] = calls[0];

  assert.equal(command, 'npm');
  assert.deepEqual(args, ['run', 'db:migrate:status']);
  assert.deepEqual(options, {
    cwd: 'C:/project',
    timeoutMs: 123,
  });
});

test('checkPrismaMigrationStatus reports an unexpected command failure', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'database connection failed',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_STATUS_FAILED');
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'database connection failed',
    stdout: '',
    timedOut: false,
  });
});

test('checkPrismaMigrationStatus classifies pending migrations', async () => {
  const calls = [];

  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 1,
        ok: false,
        stderr: '',
        stdout: '1 migration have not yet been applied',
        timedOut: false,
      };
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_PENDING');
  assert.equal(calls.length, 1);
});

test('checkPrismaMigrationStatus classifies pending migrations from stderr', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: '1 migration have not yet been applied',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_PENDING');
});

test('checkPrismaMigrationStatus classifies failed migrations', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'Database contains a failed migration',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_FAILED');
});

test('checkPrismaMigrationStatus classifies different migration history', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: '',
      stdout: 'The migration history is different from the local migrations',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_DIVERGED');
});

test('checkPrismaMigrationStatus classifies modified applied migrations', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'Migration was modified since it was applied',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_DIVERGED');
});

test('checkPrismaMigrationStatus reports command timeout', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: null,
      ok: false,
      stderr: '',
      stdout: '1 migration have not yet been applied',
      timedOut: true,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_STATUS_FAILED');
  assert.notEqual(result.code, 'PRISMA_MIGRATIONS_PENDING');
  assert.equal(result.details.timedOut, true);
});

test('checkPrismaMigrationStatus maps command runner rejection to OperationResult', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error('spawn failed');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_STATUS_FAILED');
  assert.equal(result.details.error, 'spawn failed');
});

test('deployPrismaMigrations deploys migrations successfully', async () => {
  const calls = [];

  const result = await deployPrismaMigrations({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
    timeoutMs: 456,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_DEPLOYED');
  assert.equal(calls.length, 1);

  const [command, args, options] = calls[0];

  assert.equal(command, 'npm');
  assert.deepEqual(args, ['run', 'db:migrate:deploy']);
  assert.deepEqual(options, {
    cwd: 'C:/project',
    timeoutMs: 456,
  });
});

test('deployPrismaMigrations uses deploy command and maps failure', async () => {
  const calls = [];

  const result = await deployPrismaMigrations({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 1,
        ok: false,
        stderr: 'deploy failed',
        stdout: '',
        timedOut: false,
      };
    },
    timeoutMs: 456,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_DEPLOY_FAILED');
  assert.equal(calls.length, 1);

  const [command, args, options] = calls[0];

  assert.equal(command, 'npm');
  assert.deepEqual(args, ['run', 'db:migrate:deploy']);
  assert.deepEqual(options, {
    cwd: 'C:/project',
    timeoutMs: 456,
  });
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'deploy failed',
    stdout: '',
    timedOut: false,
  });
});

test('deployPrismaMigrations reports command timeout', async () => {
  const result = await deployPrismaMigrations({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: null,
      ok: false,
      stderr: '',
      stdout: '',
      timedOut: true,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_DEPLOY_FAILED');
  assert.equal(result.details.timedOut, true);
});

test('deployPrismaMigrations maps command runner rejection to OperationResult', async () => {
  const result = await deployPrismaMigrations({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error('spawn failed');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_MIGRATION_DEPLOY_FAILED');
  assert.equal(result.details.error, 'spawn failed');
});

test('Prisma migration operations do not leak command diagnostics secrets', async () => {
  const result = await deployPrismaMigrations({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: `failed ${SECRET_MARKERS[0]}`,
      stdout: `output ${SECRET_MARKERS[1]}`,
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
});

test('Prisma migration operations do not leak rejection secrets', async () => {
  const result = await checkPrismaMigrationStatus({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error(`spawn failed ${SECRET_MARKERS[0]}`);
    },
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
});
