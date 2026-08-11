import assert from 'node:assert/strict';
import test from 'node:test';

import { deployPrismaMigrations } from '../../../../scripts/infrastructure/prisma/migrations.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

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

test('deployPrismaMigrations passes env to the command when provided', async () => {
  const env = {
    DATABASE_URL: 'postgresql://example',
    NODE_ENV: 'production',
  };
  const calls = [];

  const result = await deployPrismaMigrations({
    env,
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
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][2], {
    cwd: 'C:/project',
    env,
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

test('deployPrismaMigrations does not leak command diagnostics secrets', async () => {
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
