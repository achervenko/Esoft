import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { rm, writeFile } from 'node:fs/promises';
import { parseRestoreArguments } from '../../../scripts/prod/restore-prod.filesystem.mjs';
import { readRestoreManifest } from '../../../scripts/prod/restore-prod.manifest.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createConfig, createManifest, createRestoreProject } from './helpers/restore-prod-helpers.mjs';

test('parseRestoreArguments supports --backup value and --backup=value', () => {
  const valueResult = parseRestoreArguments([
    '--backup',
    'C:/backups/2026-08-03_09-30-00',
    '--confirm',
  ]);
  assertOperationResult(valueResult, { ok: true });

  const equalsResult = parseRestoreArguments([
    '--backup=C:/backups/2026-08-03_09-30-00',
    '--confirm',
  ]);
  assertOperationResult(equalsResult, { ok: true });
});

test('readRestoreManifest reports missing backup, missing manifest and invalid JSON', async () => {
  const project = await createRestoreProject();

  try {
    const missingBackupResult = await readRestoreManifest({
      backupPath: join(project.root, 'missing'),
      config: createConfig(project),
    });
    assertOperationResult(missingBackupResult, { ok: false });
    assert.equal(missingBackupResult.code, 'RESTORE_BACKUP_MISSING');

    await rm(join(project.backupPath, 'backup.json'));
    const missingManifestResult = await readRestoreManifest({
      backupPath: project.backupPath,
      config: createConfig(project),
    });
    assertOperationResult(missingManifestResult, { ok: false });
    assert.equal(missingManifestResult.code, 'RESTORE_MANIFEST_INVALID');

    await writeFile(join(project.backupPath, 'backup.json'), '{');
    const invalidJsonResult = await readRestoreManifest({
      backupPath: project.backupPath,
      config: createConfig(project),
    });
    assertOperationResult(invalidJsonResult, { ok: false });
    assert.equal(invalidJsonResult.code, 'RESTORE_MANIFEST_INVALID');
  } finally {
    await project.remove();
  }
});

test('readRestoreManifest rejects backup and manifest symlinks before reading JSON', async () => {
  const project = await createRestoreProject();

  try {
    for (const [artifactName, expectedCode, expectedPath] of [
      ['backup', 'RESTORE_BACKUP_UNSAFE', project.backupPath],
      ['backup.json', 'RESTORE_ARTIFACTS_UNSAFE', join(project.backupPath, 'backup.json')],
    ]) {
      const calls = [];
      const result = await readRestoreManifest({
        backupPath: project.backupPath,
        config: createConfig(project),
        filesystem: {
          lstat: async (path) => ({
            isDirectory: () => path === project.backupPath,
            isFile: () => path === join(project.backupPath, 'backup.json'),
            isSymbolicLink: () => path === expectedPath,
            size: 10,
          }),
          readFile: async () => {
            calls.push('readFile');
            return '{}';
          },
        },
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, expectedCode);
      assert.deepEqual(calls, [], artifactName);
    }
  } finally {
    await project.remove();
  }
});

test('readRestoreManifest rejects unsupported format and bucket mismatch', async () => {
  const unsupportedProject = await createRestoreProject({
    manifest: createManifest({ formatVersion: 1 }),
  });
  const mismatchProject = await createRestoreProject({
    manifest: createManifest({
      storage: {
        bucket: 'other-bucket',
        directory: 'storage',
        objectCount: 2,
        totalBytes: 23,
      },
    }),
  });

  try {
    const unsupportedResult = await readRestoreManifest({
      backupPath: unsupportedProject.backupPath,
      config: createConfig(unsupportedProject),
    });
    assertOperationResult(unsupportedResult, { ok: false });
    assert.equal(unsupportedResult.code, 'RESTORE_MANIFEST_INVALID');

    const mismatchResult = await readRestoreManifest({
      backupPath: mismatchProject.backupPath,
      config: createConfig(mismatchProject),
    });
    assertOperationResult(mismatchResult, { ok: false });
    assert.equal(mismatchResult.code, 'RESTORE_BUCKET_MISMATCH');
  } finally {
    await unsupportedProject.remove();
    await mismatchProject.remove();
  }
});
