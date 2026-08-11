import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkStorageBucket as checkRestoreStorageBucket,
  replaceStorageBucket,
  verifyRestoredStorage,
} from '../../../scripts/prod/restore-prod.storage.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createConfig,
  createRestoreProject,
  createS3Runtime,
} from './helpers/restore-prod-helpers.mjs';

test('restore storage bucket reports client cleanup failure after successful check', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    destroyError: new Error('destroy failed'),
  });

  try {
    const result = await checkRestoreStorageBucket({
      config: createConfig(project),
      HeadBucketCommand: s3Runtime.runtimeDependencies.HeadBucketCommand,
      S3Client: s3Runtime.runtimeDependencies.S3Client,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
    assert.equal(result.details.cleanupError, 'destroy failed');
    assert.equal(result.details.operationResult.code, 'MINIO_BUCKET_AVAILABLE');
  } finally {
    await project.remove();
  }
});

test('restore storage bucket preserves main failure when client cleanup fails', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    destroyError: new Error('destroy failed'),
    headError: Object.assign(new Error('access denied'), {
      name: 'AccessDenied',
    }),
  });

  try {
    const result = await checkRestoreStorageBucket({
      config: createConfig(project),
      HeadBucketCommand: s3Runtime.runtimeDependencies.HeadBucketCommand,
      S3Client: s3Runtime.runtimeDependencies.S3Client,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_BUCKET_UNAVAILABLE');
    assert.equal(result.details.cleanupError, 'destroy failed');
  } finally {
    await project.remove();
  }
});

test('restore replacement reports client cleanup failure after success', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    destroyError: new Error('destroy failed'),
    objects: new Map([['old.txt', 'old']]),
  });

  try {
    const result = await replaceStorageBucket({
      config: createConfig(project),
      DeleteObjectCommand: s3Runtime.runtimeDependencies.DeleteObjectCommand,
      ListObjectsV2Command: s3Runtime.runtimeDependencies.ListObjectsV2Command,
      PutObjectCommand: s3Runtime.runtimeDependencies.PutObjectCommand,
      S3Client: s3Runtime.runtimeDependencies.S3Client,
      storagePath: `${project.backupPath}/storage`,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
    assert.equal(result.details.cleanupError, 'destroy failed');
    assert.equal(result.details.operationResult.code, 'MINIO_RESTORE_OK');
  } finally {
    await project.remove();
  }
});

test('restore verification preserves main failure when client cleanup fails', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    destroyError: new Error('destroy failed'),
    objects: new Map([['only.txt', 'content']]),
  });

  try {
    const result = await verifyRestoredStorage({
      config: createConfig(project),
      expectedObjectCount: 2,
      expectedTotalBytes: 100,
      ListObjectsV2Command: s3Runtime.runtimeDependencies.ListObjectsV2Command,
      S3Client: s3Runtime.runtimeDependencies.S3Client,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_RESTORE_VERIFY_FAILED');
    assert.equal(result.details.cleanupError, 'destroy failed');
  } finally {
    await project.remove();
  }
});
