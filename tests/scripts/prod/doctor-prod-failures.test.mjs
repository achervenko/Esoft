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

test('doctor:prod continues independent checks after PostgreSQL failure', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PROD_DOCTOR_FAILED');
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

test('doctor:prod reports multiple independent failures', async () => {
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
      checkFrontendBuild: () =>
        failure('PROD_FRONTEND_BUILD_MISSING', 'Frontend build is missing'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'POSTGRES_CONNECTION_FAILED',
    ),
    true,
  );
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PROD_FRONTEND_BUILD_MISSING',
    ),
    true,
  );
});

test('doctor:prod maps thrown check exceptions and continues', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () => {
        throw new Error('boom');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PROD_DOCTOR_CHECK_FAILED',
    ),
    true,
  );
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

test('doctor:prod does not leak secrets from output or final result', async () => {
  const output = createOutput();
  const result = await runProductionDoctor({
    ...createTestRuntime({ output }),
    operations: createOperations({
      checkPostgresConnection: () =>
        failure(
          'POSTGRES_CONNECTION_FAILED',
          `Unable to connect DATABASE_URL=${SECRET_MARKERS[0]}`,
        ),
      checkStorageBucket: () =>
        failure(
          'MINIO_ACCESS_DENIED',
          `Access denied MINIO_SECRET_KEY=${SECRET_MARKERS[1]}`,
        ),
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});
