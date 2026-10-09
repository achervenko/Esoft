import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import locks from '../../../scripts/infrastructure/operations/installation-lock.cjs';
import { createBackupProject } from './helpers/backup-prod-helpers.mjs';

for (const partial of [false, true]) {
  test(`metadata write failure removes own ${partial ? 'partial' : 'empty'} lock and permits retry`, async () => {
    const project = await createBackupProject();
    const original = new Error('metadata write failed');
    const lockPath = join(project.root, '.local', '.production-operation.lock');
    try {
      assert.throws(
        () =>
          locks.acquireInstallationLock({
            projectRoot: project.root,
            operation: 'backend',
            filesystem: {
              ...fs,
              writeFileSync(fd) {
                if (partial) fs.writeFileSync(fd, '{');
                throw original;
              },
            },
          }),
        (error) => error === original,
      );
      assert.equal(fs.existsSync(lockPath), false);
      locks
        .acquireInstallationLock({
          projectRoot: project.root,
          operation: 'backend',
        })
        .release();
    } finally {
      await project.remove();
    }
  });
}

test('failed initialization cleanup is explicit and preserves the original error and lock', async () => {
  const project = await createBackupProject();
  const original = new Error('write failed');
  const cleanup = new Error('unlink denied');
  const lockPath = join(project.root, '.local', '.production-operation.lock');
  try {
    assert.throws(
      () =>
        locks.acquireInstallationLock({
          projectRoot: project.root,
          operation: 'backup',
          filesystem: {
            ...fs,
            writeFileSync() {
              throw original;
            },
            unlinkSync() {
              throw cleanup;
            },
          },
        }),
      (error) => {
        assert.equal(error.code, 'INSTALLATION_LOCK_CLEANUP_FAILED');
        assert.equal(error.cause, original);
        assert.equal(error.cleanupError, cleanup);
        assert.equal(error.lockPath, lockPath);
        return true;
      },
    );
    assert.equal(fs.existsSync(lockPath), true);
  } finally {
    await project.remove();
  }
});

test('initialization failure never deletes a replacement lock', async () => {
  const project = await createBackupProject();
  const lockPath = join(project.root, '.local', '.production-operation.lock');
  try {
    assert.throws(
      () =>
        locks.acquireInstallationLock({
          projectRoot: project.root,
          operation: 'backup',
          filesystem: {
            ...fs,
            writeFileSync(fd) {
              fs.renameSync(lockPath, `${lockPath}.original`);
              fs.writeFileSync(lockPath, 'other-owner');
              throw new Error('write failed');
            },
          },
        }),
      { code: 'INSTALLATION_LOCK_CLEANUP_FAILED' },
    );
    assert.equal(fs.readFileSync(lockPath, 'utf8'), 'other-owner');
  } finally {
    await project.remove();
  }
});
