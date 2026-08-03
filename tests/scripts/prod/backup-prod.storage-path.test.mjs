import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  backupStorageBucket,
  resolveObjectBackupPath,
} from '../../../scripts/prod/backup-prod.storage.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createTemporaryProject } from '../helpers/temporary-project.mjs';
import { createConfig, createS3Runtime } from './helpers/backup-prod-helpers.mjs';

test('backupStorageBucket rejects Windows-unsafe object key segments', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');

  try {
    await mkdir(storagePath);

    for (const objectKey of [
      'folder/file:name.pdf',
      'folder/CON',
      'folder/AUX.txt',
      'folder/file.',
      'folder/file ',
    ]) {
      const s3Runtime = createS3Runtime({
        objects: new Map([[objectKey, 'nope']]),
      });
      const result = await backupStorageBucket({
        config: createConfig(project),
        storagePath,
        ...s3Runtime.runtimeDependencies,
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, 'MINIO_OBJECT_PATH_UNSAFE');
    }
  } finally {
    await project.remove();
  }
});

test('backupStorageBucket rejects case-insensitive local path collisions', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['folder/A.txt', 'upper'],
      ['folder/a.txt', 'lower'],
    ]),
  });

  try {
    await mkdir(storagePath);
    const result = await backupStorageBucket({
      config: createConfig(project),
      storagePath,
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_OBJECT_PATH_UNSAFE');
  } finally {
    await project.remove();
  }
});

test('backupStorageBucket rejects file and directory path conflicts', async () => {
  const project = await createTemporaryProject();

  try {
    for (const [index, objects] of [
      new Map([
        ['folder', 'file'],
        ['folder/file.txt', 'nested'],
      ]),
      new Map([
        ['folder/file.txt', 'nested'],
        ['folder', 'file'],
      ]),
    ].entries()) {
      const storagePath = join(project.root, `storage-${index}`);
      const s3Runtime = createS3Runtime({ objects });

      await mkdir(storagePath);

      const result = await backupStorageBucket({
        config: createConfig(project),
        storagePath,
        ...s3Runtime.runtimeDependencies,
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, 'MINIO_OBJECT_PATH_UNSAFE');
    }
  } finally {
    await project.remove();
  }
});

test('unsafe object keys are blocked before writing outside storage', async () => {
  const project = await createTemporaryProject();
  const storagePath = join(project.root, 'storage');
  const s3Runtime = createS3Runtime({
    objects: new Map([['../../outside.txt', 'nope']]),
  });

  try {
    await mkdir(storagePath);
    const result = await backupStorageBucket({
      config: createConfig(project),
      storagePath,
      ...s3Runtime.runtimeDependencies,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_OBJECT_PATH_UNSAFE');
    assert.equal(existsSync(join(project.root, 'outside.txt')), false);
  } finally {
    await project.remove();
  }
});

test('resolveObjectBackupPath rejects unsafe object keys', () => {
  const storagePath = resolve('storage');

  for (const key of [
    '',
    'folder/',
    'folder//file.txt',
    './file.txt',
    'folder/./file.txt',
    'folder/../file.txt',
    '/absolute/file.txt',
    'C:/absolute/file.txt',
    'a\\b.txt',
    'folder/file:name.pdf',
    'folder/CON',
    'folder/file.',
    'folder/file ',
  ]) {
    const result = resolveObjectBackupPath(storagePath, key);

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'MINIO_OBJECT_PATH_UNSAFE');
  }
});
