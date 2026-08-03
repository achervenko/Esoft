import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  replaceStorageBucket,
  verifyRestoredStorage,
} from '../../../scripts/prod/restore-prod.storage.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createConfig,
  createManifest,
  createRestoreProject,
  createS3Runtime,
} from './helpers/restore-prod-helpers.mjs';

test('replaceStorageBucket deletes existing objects and uploads backup files', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['old.txt', 'old'],
      ['old/nested.txt', 'nested'],
    ]),
  });

  try {
    const result = await replaceStorageBucket({
      config: createConfig(project),
      storagePath: join(project.backupPath, 'storage'),
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.details.deletedObjectCount, 2);
    assert.equal(result.details.objectCount, 2);
    assert.deepEqual(
      s3Runtime.calls.filter((call) => call.type === 'delete').map((call) => call.input.Key),
      ['old.txt', 'old/nested.txt'],
    );
    assert.equal(s3Runtime.objects.has('old.txt'), false);
    assert.equal(s3Runtime.objects.get('manuals/manual.pdf'), 'manual-bytes');
    assert.equal(s3Runtime.calls.some((call) => call.type === 'destroy'), true);
  } finally {
    await project.remove();
  }
});

test('replaceStorageBucket does not clear bucket when backup storage cannot be listed', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    objects: new Map([['old.txt', 'old']]),
  });

  try {
    await rm(join(project.backupPath, 'storage'), {
      force: true,
      recursive: true,
    });

    const result = await replaceStorageBucket({
      config: createConfig(project),
      storagePath: join(project.backupPath, 'storage'),
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'RESTORE_STORAGE_INVALID');
    assert.equal(s3Runtime.objects.get('old.txt'), 'old');
    assert.equal(s3Runtime.calls.some((call) => call.type === 'list'), false);
    assert.equal(s3Runtime.calls.some((call) => call.type === 'delete'), false);
    assert.equal(s3Runtime.calls.some((call) => call.type === 'destroy'), true);
  } finally {
    await project.remove();
  }
});

test('replaceStorageBucket does not delete objects when truncated listing has no continuation token', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    objects: new Map([['old.txt', 'old']]),
    pages: [
      {
        Contents: [{ Key: 'old.txt', Size: 3 }],
        IsTruncated: true,
      },
    ],
  });

  try {
    const result = await replaceStorageBucket({
      config: createConfig(project),
      storagePath: join(project.backupPath, 'storage'),
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_RESTORE_FAILED');
    assert.equal(
      result.message,
      'MinIO object listing is truncated without a continuation token',
    );
    assert.equal(s3Runtime.objects.get('old.txt'), 'old');
    assert.equal(s3Runtime.calls.some((call) => call.type === 'delete'), false);
    assert.equal(s3Runtime.calls.some((call) => call.type === 'destroy'), true);
  } finally {
    await project.remove();
  }
});

test('replaceStorageBucket supports pagination when deleting current bucket', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['old-1.txt', 'old-1'],
      ['old-2.txt', 'old-2'],
    ]),
    pages: [
      {
        Contents: [{ Key: 'old-1.txt', Size: 5 }],
        IsTruncated: true,
        NextContinuationToken: 'next-page',
      },
      {
        Contents: [{ Key: 'old-2.txt', Size: 5 }],
        IsTruncated: false,
      },
    ],
  });

  try {
    const result = await replaceStorageBucket({
      config: createConfig(project),
      storagePath: join(project.backupPath, 'storage'),
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: true });
    assert.deepEqual(
      s3Runtime.calls
        .filter((call) => call.type === 'list')
        .map((call) => call.input.ContinuationToken),
      [undefined, 'next-page'],
    );
  } finally {
    await project.remove();
  }
});

test('empty backup storage clears MinIO bucket', async () => {
  const project = await createRestoreProject({
    manifest: createManifest({
      storage: {
        bucket: 'esoft',
        directory: 'storage',
        objectCount: 0,
        totalBytes: 0,
      },
    }),
    storageFiles: {},
  });
  const s3Runtime = createS3Runtime({
    objects: new Map([['old.txt', 'old']]),
  });

  try {
    const result = await replaceStorageBucket({
      config: createConfig(project),
      storagePath: join(project.backupPath, 'storage'),
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.details.deletedObjectCount, 1);
    assert.equal(result.details.objectCount, 0);
    assert.equal(s3Runtime.objects.size, 0);
  } finally {
    await project.remove();
  }
});

test('replaceStorageBucket reports delete and upload errors and destroys client', async () => {
  const project = await createRestoreProject();

  class FailingDeleteCommand {
    constructor(input) {
      this.input = input;
    }
  }

  try {
    const deleteRuntime = createS3Runtime({
      objects: new Map([['old.txt', 'old']]),
    });
    class DeleteFailingS3Client extends deleteRuntime.runtimeDependencies.S3Client {
      async send(command) {
        if (command instanceof FailingDeleteCommand) {
          throw new Error('delete failed');
        }

        return super.send(command);
      }
    }

    const deleteResult = await replaceStorageBucket({
      config: createConfig(project),
      DeleteObjectCommand: FailingDeleteCommand,
      ListObjectsV2Command: deleteRuntime.runtimeDependencies.ListObjectsV2Command,
      PutObjectCommand: deleteRuntime.runtimeDependencies.PutObjectCommand,
      S3Client: DeleteFailingS3Client,
      storagePath: join(project.backupPath, 'storage'),
    });

    assertOperationResult(deleteResult, { ok: false });
    assert.equal(deleteResult.code, 'MINIO_RESTORE_FAILED');
    assert.equal(deleteRuntime.calls.some((call) => call.type === 'destroy'), true);

    const uploadRuntime = createS3Runtime();
    class PutFailingS3Client extends uploadRuntime.runtimeDependencies.S3Client {
      async send(command) {
        if (command instanceof uploadRuntime.runtimeDependencies.PutObjectCommand) {
          throw new Error('put failed');
        }

        return super.send(command);
      }
    }

    const uploadResult = await replaceStorageBucket({
      config: createConfig(project),
      DeleteObjectCommand: uploadRuntime.runtimeDependencies.DeleteObjectCommand,
      ListObjectsV2Command: uploadRuntime.runtimeDependencies.ListObjectsV2Command,
      PutObjectCommand: uploadRuntime.runtimeDependencies.PutObjectCommand,
      S3Client: PutFailingS3Client,
      storagePath: join(project.backupPath, 'storage'),
    });

    assertOperationResult(uploadResult, { ok: false });
    assert.equal(uploadResult.code, 'MINIO_RESTORE_FAILED');
    assert.equal(uploadRuntime.calls.some((call) => call.type === 'destroy'), true);
  } finally {
    await project.remove();
  }
});

test('verifyRestoredStorage checks object count and total size', async () => {
  const project = await createRestoreProject();
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['equipment/equipment_card/42/equipment_photo/photo.webp', 'photo-bytes'],
      ['manuals/manual.pdf', 'manual-bytes'],
    ]),
  });

  try {
    const result = await verifyRestoredStorage({
      config: createConfig(project),
      expectedObjectCount: 2,
      expectedTotalBytes: 'photo-bytes'.length + 'manual-bytes'.length,
      ListObjectsV2Command: s3Runtime.runtimeDependencies.ListObjectsV2Command,
      S3Client: s3Runtime.runtimeDependencies.S3Client,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(s3Runtime.calls.some((call) => call.type === 'destroy'), true);
  } finally {
    await project.remove();
  }
});

test('verifyRestoredStorage rejects objects with invalid size metadata', async () => {
  const project = await createRestoreProject();

  try {
    for (const Size of [undefined, -1, 1.5]) {
      const s3Runtime = createS3Runtime({
        pages: [
          {
            Contents: [{ Key: 'manuals/manual.pdf', Size }],
            IsTruncated: false,
          },
        ],
      });

      const result = await verifyRestoredStorage({
        config: createConfig(project),
        expectedObjectCount: 1,
        expectedTotalBytes: 0,
        ListObjectsV2Command: s3Runtime.runtimeDependencies.ListObjectsV2Command,
        S3Client: s3Runtime.runtimeDependencies.S3Client,
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, 'MINIO_RESTORE_VERIFY_FAILED');
      assert.equal(result.message, 'MinIO object has an invalid size');
      assert.equal(result.details.objectKey, 'manuals/manual.pdf');
      assert.equal(s3Runtime.calls.some((call) => call.type === 'destroy'), true);
    }
  } finally {
    await project.remove();
  }
});
