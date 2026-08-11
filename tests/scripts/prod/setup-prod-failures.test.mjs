import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionSetup } from '../../../scripts/prod/setup-prod.mjs';
import { loadProductionConfig } from '../../../scripts/prod/setup-prod.config.mjs';
import { failure } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createOperations,
  createOutput,
  createTestRuntime,
} from './helpers/setup-prod-helpers.mjs';

test('setup:prod stops before DB mutations when production mode guard fails', async () => {
  const calls = [];
  const output = createOutput();

  const result = await runProductionSetup({
    ...createTestRuntime({ output }),
    operations: createOperations({
      calls,
      loadProductionConfig: () => ({
        result: failure(
          'PROD_MODE_REQUIRED',
          `Production mode requires NODE_ENV=production. ${SECRET_MARKERS[0]}`,
        ),
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PROD_MODE_REQUIRED');
  assert.deepEqual(calls, ['loadProductionConfig']);
  assertNoSecretLeak(output.lines);
  assertNoSecretLeak(result);
});

test('loadProductionConfig reports production guard after valid non-production config', async () => {
  const loaded = await loadProductionConfig({
    loadConfig: () => ({
      config: {
        nodeEnv: 'development',
      },
      envPath: 'C:/project/.env',
      projectRoot: 'C:/project',
    }),
    projectRoot: 'C:/project',
    validateConfig: () => ({
      envPath: 'C:/project/.env',
      errors: [],
      valid: true,
      warnings: [],
    }),
  });

  assertOperationResult(loaded.result, { ok: false });
  assert.equal(loaded.result.code, 'PROD_MODE_REQUIRED');
});

test('setup:prod stops after seed failure before checking MinIO', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      seedDatabase: () => failure('PRISMA_SEED_FAILED', 'Seed failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_SEED_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
    'seedDatabase',
  ]);
});

test('setup:prod maps thrown operation exceptions to stage failure', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      generatePrismaClient: () => {
        throw new Error('boom');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PROD_SETUP_STAGE_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
  ]);
});

test('setup:prod does not leak secrets from command diagnostics', async () => {
  const output = createOutput();
  const result = await runProductionSetup({
    ...createTestRuntime({ output }),
    operations: createOperations({
      generatePrismaClient: () =>
        failure('PRISMA_CLIENT_GENERATION_FAILED', 'Generate failed', {
          stderr: `DATABASE_URL=${SECRET_MARKERS[0]}`,
          stdout: `MINIO_SECRET_KEY=${SECRET_MARKERS[1]}`,
        }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});
