import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultProductionSetupOperations } from '../../../scripts/prod/setup-prod.operations.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createConfig,
  createS3ClientClass,
} from './helpers/setup-prod-helpers.mjs';

test('setup:prod default storage bucket reports client cleanup failure', async () => {
  const operations = createDefaultProductionSetupOperations();
  const result = await operations.ensureStorageBucket({
    config: createConfig(),
    CreateBucketCommand: class CreateBucketCommand {},
    HeadBucketCommand: class HeadBucketCommand {},
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
  assert.equal(result.details.cleanupError, 'destroy failed');
  assert.equal(result.details.operationResult.code, 'MINIO_BUCKET_AVAILABLE');
});

test('setup:prod default storage bucket preserves main failure when cleanup fails', async () => {
  const operations = createDefaultProductionSetupOperations();
  const result = await operations.ensureStorageBucket({
    config: createConfig(),
    CreateBucketCommand: class CreateBucketCommand {},
    HeadBucketCommand: class HeadBucketCommand {},
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
      headBucketError: Object.assign(new Error('access denied'), {
        name: 'AccessDenied',
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_ACCESS_DENIED');
  assert.equal(result.details.cleanupError, 'destroy failed');
});
