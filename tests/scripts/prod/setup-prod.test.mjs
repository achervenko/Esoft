import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionSetup } from '../../../scripts/prod/setup-prod.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createOperations,
  createTestRuntime,
} from './helpers/setup-prod-helpers.mjs';

test('setup:prod successful flow calls stages in the expected order', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      migrationStatuses: [
        failure(
          'PRISMA_MIGRATIONS_PENDING',
          'Prisma migrations are pending',
        ),
        success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
      ],
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_SETUP_OK');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
    'seedDatabase',
    'ensureStorageBucket',
  ]);
});

test('setup:prod treats an existing MinIO bucket as successful and idempotent', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      ensureStorageBucket: () =>
        success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available'),
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_SETUP_OK');
  assert.equal(calls.at(-1), 'ensureStorageBucket');
});
