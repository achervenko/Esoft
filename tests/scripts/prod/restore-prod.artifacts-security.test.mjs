import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { validateRestoreArtifacts } from '../../../scripts/prod/restore-prod.filesystem.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createRestoreProject } from './helpers/restore-prod-helpers.mjs';

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
