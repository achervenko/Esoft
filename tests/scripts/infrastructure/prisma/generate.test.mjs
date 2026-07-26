import assert from 'node:assert/strict';
import test from 'node:test';

import { generatePrismaClient } from '../../../../scripts/infrastructure/prisma/generate.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

test('generatePrismaClient calls the root db:generate script', async () => {
  const calls = [];
  const result = await generatePrismaClient({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);
      return { code: 0, ok: true, stderr: '', stdout: '', timedOut: false };
    },
    timeoutMs: 123,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_CLIENT_GENERATED');
  assert.equal(calls.length, 1);
  const [command, args, options] = calls[0];
  assert.equal(command, 'npm');
  assert.deepEqual(args, ['run', 'db:generate']);
  assert.deepEqual(options, {
    cwd: 'C:/project',
    timeoutMs: 123,
  });
});

test('generatePrismaClient reports command timeout', async () => {
  const result = await generatePrismaClient({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => ({
      code: null,
      ok: false,
      stderr: '',
      stdout: '',
      timedOut: true,
    }),
    timeoutMs: 123,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_CLIENT_GENERATION_FAILED');
  assert.deepEqual(result.details, {
    code: null,
    stderr: '',
    stdout: '',
    timedOut: true,
  });
});

test('generatePrismaClient maps command runner rejection to OperationResult', async () => {
  const result = await generatePrismaClient({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error('spawn failed');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_CLIENT_GENERATION_FAILED');
  assert.equal(result.details.error, 'spawn failed');
});

test('generatePrismaClient maps command failure to OperationResult', async () => {
  const calls = [];
  const result = await generatePrismaClient({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 1,
        ok: false,
        stderr: 'failed',
        stdout: '',
        timedOut: false,
      };
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_CLIENT_GENERATION_FAILED');
  assert.equal(calls.length, 1);
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'failed',
    stdout: '',
    timedOut: false,
  });
});

test('generatePrismaClient does not leak secrets from command diagnostics', async () => {
  const result = await generatePrismaClient({
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

test('generatePrismaClient does not leak secrets from command runner rejection', async () => {
  const result = await generatePrismaClient({
    npm: 'npm',
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error(`spawn failed ${SECRET_MARKERS[0]}`);
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PRISMA_CLIENT_GENERATION_FAILED');
  assertNoSecretLeak(result);
});
