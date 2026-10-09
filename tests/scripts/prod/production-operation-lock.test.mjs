import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { withProductionOperationLock } from '../../../scripts/prod/production-operation-lock.mjs';
import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import {
  createBackupProject,
  createConfig,
  createTestRuntime,
} from './helpers/backup-prod-helpers.mjs';

test('backup and restore cannot overlap in the same installation', async () => {
  const project = await createBackupProject();
  let unblock;
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const pending = new Promise((resolve) => {
    unblock = resolve;
  });
  const loaded = () => ({
    config: createConfig(project),
    projectRoot: project.root,
    result: success('CONFIG_OK', 'ok'),
  });
  const backup = runProductionBackup({
    ...createTestRuntime({ projectRoot: project.root }),
    operations: {
      loadProductionConfig: loaded,
      checkPgDumpAvailable: async () => {
        entered();
        await pending;
        return failure('TEST_STOP', 'stop before actual backup');
      },
    },
  });
  try {
    await ready;
    let reads = 0;
    const restore = await runProductionRestore({
      ...createTestRuntime({ projectRoot: project.root }),
      argv: ['--backup', project.root, '--confirm'],
      operations: {
        loadProductionConfig: loaded,
        readRestoreManifest: () => {
          reads += 1;
          throw new Error('must not run');
        },
      },
    });
    assert.equal(restore.details.failedCode, 'PRODUCTION_OPERATION_BUSY');
    assert.equal(reads, 0);
  } finally {
    unblock();
    await backup;
    await project.remove();
  }
});

for (const mode of ['success', 'failure', 'throw']) {
  test(`lock is released after ${mode}`, async () => {
    const project = await createBackupProject();
    const options = { projectRoot: project.root, operation: 'backup' };
    try {
      const run = async () => {
        if (mode === 'throw') throw new Error('operation failed');
        return mode === 'success'
          ? success('OK', 'ok')
          : failure('FAIL', 'fail');
      };
      if (mode === 'throw')
        await assert.rejects(
          withProductionOperationLock({ ...options, run }),
          /operation failed/,
        );
      else
        assert.equal(
          (await withProductionOperationLock({ ...options, run })).ok,
          mode === 'success',
        );
      const next = await withProductionOperationLock({
        ...options,
        operation: 'restore',
        run: async () => success('OK', 'ok'),
      });
      assert.equal(next.ok, true);
    } finally {
      await project.remove();
    }
  });
}

for (const mode of ['success', 'failure', 'throw']) {
  test(`a replaced lock reports cleanup failure after ${mode}`, async () => {
    const project = await createBackupProject();
    const lockPath = join(project.root, '.local', '.production-operation.lock');
    try {
      const result = await withProductionOperationLock({
        projectRoot: project.root,
        operation: 'backup',
        run: async () => {
          await writeFile(lockPath, JSON.stringify({ token: 'other-owner' }));
          if (mode === 'throw') throw new Error('operation failed');
          return mode === 'failure'
            ? failure('FAIL', 'operation failed')
            : success('OK', 'ok');
        },
      });
      assert.equal(result.code, 'PRODUCTION_OPERATION_UNLOCK_FAILED');
      if (mode === 'throw')
        assert.match(result.details.operationError, /operation failed/);
      else
        assert.equal(
          result.details.operationResult.code,
          mode === 'failure' ? 'FAIL' : 'OK',
        );
      assert.equal(
        JSON.parse(await readFile(lockPath, 'utf8')).token,
        'other-owner',
      );
      const blocked = await withProductionOperationLock({
        projectRoot: project.root,
        operation: 'restore',
        run: async () => {
          throw new Error('must not run');
        },
      });
      assert.equal(blocked.code, 'PRODUCTION_OPERATION_BUSY');
      await unlink(lockPath);
    } finally {
      await project.remove();
    }
  });
}
