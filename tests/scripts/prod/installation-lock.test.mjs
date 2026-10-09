import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';

import locks from '../../../scripts/infrastructure/operations/installation-lock.cjs';
import { withProductionOperationLock } from '../../../scripts/prod/production-operation-lock.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import { createBackupProject } from './helpers/backup-prod-helpers.mjs';

test('backend lease blocks backup and restore until released', async () => {
  const project = await createBackupProject();
  const lease = locks.acquireInstallationLock({
    projectRoot: project.root,
    operation: 'backend',
  });
  try {
    for (const operation of ['backup', 'restore']) {
      const result = await withProductionOperationLock({
        projectRoot: project.root,
        operation,
        run: () => {
          throw new Error('must not run while backend is active');
        },
      });
      assert.equal(result.code, 'PRODUCTION_OPERATION_BUSY');
    }
    const owner = JSON.parse(await readFile(lease.lockPath, 'utf8'));
    assert.equal(owner.operation, 'backend');
    assert.equal(owner.pid, process.pid);
    lease.release();
    assert.equal(
      (
        await withProductionOperationLock({
          projectRoot: project.root,
          operation: 'backup',
          run: () => success('OK', 'ok'),
        })
      ).ok,
      true,
    );
  } finally {
    lease.release();
    await project.remove();
  }
});

test('backend acquisition is refused while a production operation holds the lease', async () => {
  const project = await createBackupProject();
  try {
    await withProductionOperationLock({
      projectRoot: project.root,
      operation: 'restore',
      run: () => {
        assert.throws(
          () =>
            locks.acquireInstallationLock({
              projectRoot: project.root,
              operation: 'backend',
            }),
          { code: 'EEXIST' },
        );
        return success('OK', 'ok');
      },
    });
  } finally {
    await project.remove();
  }
});

test(
  'a crashed process leaves its lease in place for manual verification',
  { timeout: 10000 },
  async () => {
    const project = await createBackupProject();
    const modulePath = resolve(
      'scripts/infrastructure/operations/installation-lock.cjs',
    );
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
    const locks = require(process.argv[1]);
    locks.acquireInstallationLock({ projectRoot: process.argv[2], operation: 'backend' });
    process.stdout.write('ready');
    setInterval(() => {}, 1000);
  `,
        modulePath,
        project.root,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    const exited = once(child, 'exit');
    try {
      await Promise.race([
        once(child.stdout, 'data'),
        exited.then(() => {
          throw new Error('Child exited before acquiring lease');
        }),
      ]);
      const owner = JSON.parse(
        await readFile(
          join(project.root, '.local', '.production-operation.lock'),
          'utf8',
        ),
      );
      assert.equal(owner.pid, child.pid);
      child.kill('SIGKILL');
      await exited;
      assert.throws(
        () =>
          locks.acquireInstallationLock({
            projectRoot: project.root,
            operation: 'backup',
          }),
        { code: 'EEXIST' },
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      await exited;
      await project.remove();
    }
  },
);
