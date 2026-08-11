import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionDoctor } from '../../../scripts/prod/doctor-prod.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createOperations,
  createS3ClientClass,
  createTestRuntime,
  HeadBucketCommand,
} from './helpers/doctor-prod-helpers.mjs';

test('doctor:prod checks MinIO bucket without creating missing bucket', async () => {
  const calls = [];
  const commands = [];
  class S3Client {
    destroy() {
      calls.push('destroyS3Client');
    }

    async send(command) {
      commands.push(command);
      const error = new Error('missing bucket');
      error.$metadata = { httpStatusCode: 404 };
      throw error;
    }
  }

  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkStorageBucket: undefined,
    }),
    runtimeDependencies: {
      HeadBucketCommand,
      PgClient: class PgClient {},
      S3Client,
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'MINIO_BUCKET_MISSING',
    ),
    true,
  );
  assert.equal(commands.length, 1);
  assert.equal(commands[0] instanceof HeadBucketCommand, true);
  assert.deepEqual(commands[0].input, { Bucket: 'esoft' });
  assert.equal(calls.includes('destroyS3Client'), true);
});

test('doctor:prod reports storage client cleanup failure after successful bucket check', async () => {
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      checkStorageBucket: undefined,
    }),
    runtimeDependencies: {
      HeadBucketCommand,
      PgClient: class PgClient {},
      S3Client: createS3ClientClass({
        destroyError: new Error('destroy failed'),
      }),
    },
  });

  assertOperationResult(result, { ok: false });
  const storageCheck = result.details.checks.find(
    (check) => check.label === 'MinIO bucket',
  );
  assert.equal(storageCheck.result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
  assert.equal(storageCheck.result.details.cleanupError, 'destroy failed');
  assert.equal(
    storageCheck.result.details.operationResult.code,
    'MINIO_BUCKET_AVAILABLE',
  );
});

test('doctor:prod preserves storage bucket failure when client cleanup fails', async () => {
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      checkStorageBucket: undefined,
    }),
    runtimeDependencies: {
      HeadBucketCommand,
      PgClient: class PgClient {},
      S3Client: createS3ClientClass({
        destroyError: new Error('destroy failed'),
        headBucketError: Object.assign(new Error('access denied'), {
          name: 'AccessDenied',
        }),
      }),
    },
  });

  assertOperationResult(result, { ok: false });
  const storageCheck = result.details.checks.find(
    (check) => check.label === 'MinIO bucket',
  );
  assert.equal(storageCheck.result.code, 'MINIO_ACCESS_DENIED');
  assert.equal(storageCheck.result.details.cleanupError, 'destroy failed');
});
