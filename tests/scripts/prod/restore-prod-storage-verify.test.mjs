import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyRestoredStorage } from '../../../scripts/prod/restore-prod.storage.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createConfig,
  createRestoreProject,
  createS3Runtime,
} from './helpers/restore-prod-helpers.mjs';

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
