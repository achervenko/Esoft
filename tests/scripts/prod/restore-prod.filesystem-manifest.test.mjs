import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  parseRestoreArguments,
  validateRestoreArtifacts,
} from '../../../scripts/prod/restore-prod.filesystem.mjs';
import { readRestoreManifest } from '../../../scripts/prod/restore-prod.manifest.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createConfig,
  createManifest,
  createRestoreProject,
} from './helpers/restore-prod-helpers.mjs';

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
    manifest: createManifest({ formatVersion: 2 }),
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

test('validateRestoreArtifacts rejects missing or invalid dump and storage', async () => {
  const missingDumpProject = await createRestoreProject({ dumpContent: null });
  const emptyDumpProject = await createRestoreProject({ dumpContent: '' });
  const missingStorageProject = await createRestoreProject({ storageFiles: null });

  try {
    const missingDumpResult = await validateRestoreArtifacts({
      backupPath: missingDumpProject.backupPath,
    });
    assertOperationResult(missingDumpResult, { ok: false });

    const emptyDumpResult = await validateRestoreArtifacts({
      backupPath: emptyDumpProject.backupPath,
    });
    assertOperationResult(emptyDumpResult, { ok: false });
    assert.equal(emptyDumpResult.code, 'RESTORE_DUMP_INVALID');

    await rm(join(missingStorageProject.backupPath, 'storage'), {
      force: true,
      recursive: true,
    });
    const missingStorageResult = await validateRestoreArtifacts({
      backupPath: missingStorageProject.backupPath,
    });
    assertOperationResult(missingStorageResult, { ok: false });
  } finally {
    await missingDumpProject.remove();
    await emptyDumpProject.remove();
    await missingStorageProject.remove();
  }
});

test('validateRestoreArtifacts rejects unsafe storage entries', async () => {
  const project = await createRestoreProject();
  const unsafeEntryPath = join(project.backupPath, 'storage', 'dump-link');

  try {
    const result = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      filesystem: {
        readdir: async (path) => {
          if (path === join(project.backupPath, 'storage')) {
            return [
              {
                isDirectory: () => false,
                isFile: () => true,
                name: 'dump-link',
              },
            ];
          }

          return [];
        },
        lstat: async (path) => ({
          isDirectory: () =>
            path === project.backupPath ||
            path === join(project.backupPath, 'storage'),
          isFile: () =>
            path === join(project.backupPath, 'backup.json') ||
            path === join(project.backupPath, 'database.dump'),
          isSymbolicLink: () => path === unsafeEntryPath,
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'RESTORE_STORAGE_UNSAFE');
    assert.equal(result.details.path, unsafeEntryPath);
  } finally {
    await project.remove();
  }
});

test('validateRestoreArtifacts rejects backup path symlink before reading storage', async () => {
  const project = await createRestoreProject();
  const lstatCalls = [];
  const readdirCalls = [];

  try {
    const result = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      filesystem: {
        lstat: async (path) => {
          lstatCalls.push(path);

          return {
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => path === project.backupPath,
            size: 10,
          };
        },
        readdir: async () => {
          readdirCalls.push('readdir');
          return [];
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'RESTORE_BACKUP_UNSAFE');
    assert.equal(result.details.backupPath, project.backupPath);
    assert.deepEqual(lstatCalls, [project.backupPath]);
    assert.deepEqual(readdirCalls, []);
  } finally {
    await project.remove();
  }
});

test('validateRestoreArtifacts rejects root artifact symlinks before reading storage', async () => {
  const project = await createRestoreProject();

  try {
    for (const [artifactName, expectedPath] of [
      ['backup.json', join(project.backupPath, 'backup.json')],
      ['database.dump', join(project.backupPath, 'database.dump')],
      ['storage', join(project.backupPath, 'storage')],
    ]) {
      const calls = [];
      const result = await validateRestoreArtifacts({
        backupPath: project.backupPath,
        filesystem: {
          lstat: async (path) => ({
            isDirectory: () =>
              path === project.backupPath ||
              path === join(project.backupPath, 'storage'),
            isFile: () =>
              path === join(project.backupPath, 'backup.json') ||
              path === join(project.backupPath, 'database.dump'),
            isSymbolicLink: () => path === expectedPath,
            size: 10,
          }),
          readdir: async () => {
            calls.push('readdir');
            return [];
          },
        },
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, 'RESTORE_ARTIFACTS_UNSAFE');
      assert.equal(result.details.path, expectedPath);
      assert.deepEqual(calls, [], artifactName);
    }
  } finally {
    await project.remove();
  }
});

test('validateRestoreArtifacts verifies storage summary against manifest values', async () => {
  const project = await createRestoreProject();

  try {
    const countResult = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      expectedObjectCount: 100,
      expectedTotalBytes: 'photo-bytes'.length + 'manual-bytes'.length,
    });
    assertOperationResult(countResult, { ok: false });
    assert.equal(countResult.code, 'RESTORE_STORAGE_SUMMARY_MISMATCH');
    assert.equal(countResult.details.actualObjectCount, 2);

    const sizeResult = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      expectedObjectCount: 2,
      expectedTotalBytes: 100,
    });
    assertOperationResult(sizeResult, { ok: false });
    assert.equal(sizeResult.code, 'RESTORE_STORAGE_SUMMARY_MISMATCH');
    assert.equal(
      sizeResult.details.actualTotalBytes,
      'photo-bytes'.length + 'manual-bytes'.length,
    );
  } finally {
    await project.remove();
  }
});
