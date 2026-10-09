import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionDoctor } from '../../../scripts/prod/doctor-prod.mjs';
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
} from './helpers/doctor-prod-helpers.mjs';

test('doctor:prod happy path reports production environment ready', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({ calls }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_DOCTOR_OK');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'checkPrismaMigrationStatus',
    'checkStorageBucket',
    'checkBackendBuild',
    'checkFrontendBuild',
    'checkBackendRuntimeHealth',
    'checkFrontendHttp',
  ]);
});

test('doctor:prod skips config-dependent checks when production config is invalid', async () => {
  const calls = [];
  const output = createOutput();
  const result = await runProductionDoctor({
    ...createTestRuntime({ output }),
    operations: createOperations({
      calls,
      loadProductionConfig: () => ({
        result: failure(
          'PROD_CONFIG_INVALID',
          `Production configuration is invalid DATABASE_URL=${SECRET_MARKERS[0]}`,
        ),
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PROD_DOCTOR_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkBackendBuild',
    'checkFrontendBuild',
  ]);
  assert.equal(
    result.details.checks.filter(
      (check) => check.result.code === 'PROD_DOCTOR_CHECK_SKIPPED',
    ).length,
    5,
  );
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});

test('doctor:prod treats pending Prisma migrations as not ready without deploy', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPrismaMigrationStatus: () =>
        failure('PRISMA_MIGRATIONS_PENDING', 'Prisma migrations are pending'),
      deployPrismaMigrations: () => {
        throw new Error('deploy must not run');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PRISMA_MIGRATIONS_PENDING',
    ),
    true,
  );
  assert.equal(calls.includes('deployPrismaMigrations'), false);
});
