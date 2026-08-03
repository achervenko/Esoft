import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { backupStorageBucket } from '../../../scripts/prod/backup-prod.storage.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createTemporaryProject } from '../helpers/temporary-project.mjs';
import {
  createBackupProject,
  createConfig,
  createPgDumpRunner,
  createS3Runtime,
  createTestRuntime,
} from './helpers/backup-prod-helpers.mjs';

test('backup fails when MinIO bucket is unavailable', async () => {
  const project = await createBackupProject();
  const s3Runtime = createS3Runtime({
    headError: Object.assign(new Error('missing bucket'), {
      $metadata: { httpStatusCode: 404 },
    }),
  });

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: createPgDumpRunner(),
        runtimeDependencies: s3Runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'MINIO_BUCKET_UNAVAILABLE');
    assert.equal(s3Runtime.calls.some((call) => call.type === 'list'), false);
  } finally {
    await project.remove();
  }
});

test('backup accepts empty MinIO bucket', async () => {
  const project = await createBackupProject();
  const s3Runtime = createS3Runtime({ objects: new Map() });

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: createPgDumpRunner(),
        runtimeDependencies: s3Runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: true });
    const manifest = JSON.parse(
      await readFile(join(result.details.backupPath, 'backup.json'), 'utf8'),
    );
    assert.equal(manifest.storage.objectCount, 0);
    assert.equal(existsSync(join(result.details.backupPath, 'storage')), true);
  } finally {
    await project.remove();
  }
});

test('backupStorageBucket supports ListObjectsV2 pagination', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');
  const s3Runtime = createS3Runtime({
    pages: [
      {
        Contents: [{ Key: 'a/one.txt', Size: 3 }],
        IsTruncated: true,
        NextContinuationToken: 'next-page',
      },
      {
        Contents: [{ Key: 'b/two.txt', Size: 3 }],
        IsTruncated: false,
      },
    ],
    objects: new Map([
      ['a/one.txt', 'one'],
      ['b/two.txt', 'two'],
    ]),
  });

  try {
    await mkdir(storagePath);
    const result = await backupStorageBucket({
      config: createConfig(project),
      storagePath,
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.details.objectCount, 2);
    assert.equal(await readFile(join(storagePath, 'a/one.txt'), 'utf8'), 'one');
    assert.equal(await readFile(join(storagePath, 'b/two.txt'), 'utf8'), 'two');
    assert.deepEqual(
      s3Runtime.calls
        .filter((call) => call.type === 'list')
        .map((call) => call.input.ContinuationToken),
      [undefined, 'next-page'],
    );
    assert.equal(
      s3Runtime.calls.some((call) => call.type === 'destroy'),
      true,
    );
  } finally {
    await project.remove();
  }
});

test('backupStorageBucket fails when truncated listing has no continuation token', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');
  const s3Runtime = createS3Runtime({
    pages: [
      {
        Contents: [{ Key: 'a/one.txt', Size: 3 }],
        IsTruncated: true,
      },
    ],
    objects: new Map([['a/one.txt', 'one']]),
  });

  try {
    await mkdir(storagePath);
    const result = await backupStorageBucket({
      config: createConfig(project),
      storagePath,
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_BACKUP_FAILED');
    assert.equal(
      result.message,
      'MinIO object listing is truncated without a continuation token',
    );
    assert.equal(result.details.objectCount, 1);
  } finally {
    await project.remove();
  }
});

test('backupStorageBucket fails on object stream failure', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');
  const failingStream = new Readable({
    read() {
      this.destroy(new Error('stream failed'));
    },
  });
  const s3Runtime = createS3Runtime({
    objects: new Map([['file.txt', failingStream]]),
  });

  try {
    await mkdir(storagePath);
    const result = await backupStorageBucket({
      config: createConfig(project),
      storagePath,
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_BACKUP_FAILED');
    assert.equal(
      s3Runtime.calls.some((call) => call.type === 'destroy'),
      true,
    );
  } finally {
    await project.remove();
  }
});
