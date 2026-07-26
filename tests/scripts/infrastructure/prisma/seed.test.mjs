import assert from 'node:assert/strict';
import test from 'node:test';

import { seedDatabase } from '../../../../scripts/infrastructure/prisma/seed.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

test('seedDatabase calls the root db:seed script', async () => {
  const calls = [];

  const result = await seedDatabase({
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
    timeoutMs: 789,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_SEED_OK');
  assert.equal(calls.length, 1);

  const [command, args, options] = calls[0];

  assert.equal(command, 'npm');
  assert.deepEqual(args, ['run', 'db:seed']);
  assert.deepEqual(options, {
    cwd: 'C:/project',
    timeoutMs: 789,
  });
});

test('seedDatabase maps command failure', async () => {
  const calls = [];

  const result = await seedDatabase({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 1,
        ok: false,
        stderr: 'seed failed',
        stdout: 'partial output',
        timedOut: false,
      };
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_SEED_FAILED');
  assert.equal(calls.length, 1);
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'seed failed',
    stdout: 'partial output',
    timedOut: false,
  });
});

test('seedDatabase reports command timeout', async () => {
  const result = await seedDatabase({
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
  assert.equal(result.code, 'PRISMA_SEED_FAILED');
  assert.deepEqual(result.details, {
    code: null,
    stderr: '',
    stdout: '',
    timedOut: true,
  });
});

test('seedDatabase maps command runner rejection to OperationResult', async () => {
  const result = await seedDatabase({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error('spawn failed');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_SEED_FAILED');
  assert.equal(result.details.error, 'spawn failed');
});

test('seedDatabase does not leak secrets from command diagnostics', async () => {
  const result = await seedDatabase({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: `seed failed password=hunter2 DATABASE_PASSWORD="very secret value" ${SECRET_MARKERS[0]}`,
      stdout: `partial output database_url=postgresql://user:pass@host/db ${SECRET_MARKERS[1]}`,
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_SEED_FAILED');
  assert.equal(result.details.stderr.includes('hunter2'), false);
  assert.equal(result.details.stderr.includes('very secret value'), false);
  assert.equal(result.details.stdout.includes('postgresql://user:pass@host/db'), false);
  assertNoSecretLeak(result);
});

test('seedDatabase does not leak secrets from command runner rejection', async () => {
  const result = await seedDatabase({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error(`spawn failed access_token=abc123 ${SECRET_MARKERS[0]}`);
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_SEED_FAILED');
  assert.equal(result.details.error.includes('abc123'), false);
  assertNoSecretLeak(result);
});
