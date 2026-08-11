import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePreDeployMigrationStatus } from '../../../scripts/prod/setup-prod.operations.mjs';
import { runProductionSetup } from '../../../scripts/prod/setup-prod.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createOperations,
  createTestRuntime,
} from './helpers/setup-prod-helpers.mjs';

test('setup:prod does not run migrations when PostgreSQL is unavailable', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(calls, ['loadProductionConfig', 'checkPostgresConnection']);
});

test('setup:prod stops after migrate deploy failure', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      deployPrismaMigrations: () =>
        failure('PRISMA_MIGRATION_DEPLOY_FAILED', 'Deploy failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_MIGRATION_DEPLOY_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
  ]);
});

test('setup:prod stops when final migration status fails after deploy', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      migrationStatuses: [
        success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
        failure(
          'PRISMA_MIGRATIONS_FAILED',
          'Prisma has failed migrations',
        ),
      ],
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_MIGRATIONS_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
  ]);
});

test('normalizePreDeployMigrationStatus allows pending migrations before deploy', () => {
  const result = normalizePreDeployMigrationStatus(
    failure('PRISMA_MIGRATIONS_PENDING', 'Prisma migrations are pending'),
  );

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_PENDING');
});
