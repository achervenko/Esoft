import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { verifyRestoredStorageContents } from '../../../scripts/prod/restore-prod.storage-integrity.mjs';
import locks from '../../../scripts/infrastructure/operations/installation-lock.cjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  createConfig,
  createManifest,
  createPgRestoreRunner,
  createRestoreProject,
  createS3Runtime,
  createTestRuntime,
} from './helpers/restore-prod-helpers.mjs';

function options(project, runtime, calls = []) {
  return {
    ...createTestRuntime({
      argv: ['--backup', project.backupPath, '--confirm'],
      projectRoot: project.root,
      runCommand: createPgRestoreRunner({ calls }),
      runtimeDependencies: runtime.runtimeDependencies,
    }),
    clock: () => new Date('2026-10-09T14:00:00Z'),
    operations: {
      loadProductionConfig: () => ({
        config: createConfig(project),
        projectRoot: project.root,
        result: success('CONFIG_OK', 'ok'),
      }),
    },
  };
}

test('successful rollback restores both resources and allows backend to start', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([['old.txt', 'original']]),
    putErrorAt: 1,
  });
  const calls = [];
  try {
    const result = await runProductionRestore(options(project, runtime, calls));
    assert.equal(result.ok, false);
    assert.equal(result.details.failedCode, 'MINIO_RESTORE_FAILED');
    assert.equal(result.details.rollback.ok, true);
    assert.deepEqual([...runtime.objects.entries()], [['old.txt', 'original']]);
    const databaseRestores = calls.filter((call) =>
      call.args.includes('--clean'),
    );
    assert.equal(databaseRestores.length, 2);
    assert.equal(
      databaseRestores[1].args.at(-1),
      join(result.details.recoveryBackupPath, 'database.dump'),
    );
    await assert.rejects(
      access(join(project.root, '.local', '.restore-recovery-required.json')),
      { code: 'ENOENT' },
    );
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

test('failed rollback blocks backend and a subsequent explicit recovery clears the marker', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([['old.txt', 'original']]),
    putErrorAt: [1, 2],
  });
  try {
    const result = await runProductionRestore(options(project, runtime));
    assert.equal(result.details.failedCode, 'RESTORE_ROLLBACK_FAILED');
    assert.equal(result.details.rollback.ok, false);
    const markerPath = join(
      project.root,
      '.local',
      '.restore-recovery-required.json',
    );
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    assert.equal(marker.recoveryBackupPath, result.details.recoveryBackupPath);
    assert.throws(
      () =>
        locks.acquireInstallationLock({
          projectRoot: project.root,
          operation: 'backend',
        }),
      { code: 'INSTALLATION_RECOVERY_REQUIRED' },
    );
    const retry = options(project, runtime);
    retry.clock = () => new Date('2026-10-09T14:00:01Z');
    retry.argv = ['--backup', result.details.recoveryBackupPath, '--confirm'];
    assert.equal((await runProductionRestore(retry)).ok, true);
    assert.deepEqual([...runtime.objects.entries()], [['old.txt', 'original']]);
    await assert.rejects(access(markerPath), { code: 'ENOENT' });
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

test('recovery marker failure stops restore before the first destructive command', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([['old.txt', 'original']]),
  });
  const calls = [];
  try {
    const input = options(project, runtime, calls);
    input.operations.writeRestoreRecoveryState = () => {
      throw new Error('disk write failed');
    };
    const result = await runProductionRestore(input);
    assert.equal(
      result.details.failedStage,
      'Recording restore recovery state',
    );
    assert.equal(
      calls.some((call) => call.args.includes('--clean')),
      false,
    );
    assert.equal(
      runtime.calls.some(
        (call) => call.type === 'delete' || call.type === 'put',
      ),
      false,
    );
  } finally {
    await project.remove();
  }
});

test('content verification rejects same-size MinIO corruption', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([
      ['equipment/equipment_card/42/equipment_photo/photo.webp', 'PHOTO-bytes'],
      ['manuals/manual.pdf', 'manual-bytes'],
    ]),
  });
  try {
    const result = await verifyRestoredStorageContents({
      config: createConfig(project),
      manifest: createManifest(),
      ...runtime.runtimeDependencies,
    });
    assert.equal(result.code, 'MINIO_RESTORE_VERIFY_FAILED');
  } finally {
    await project.remove();
  }
});

test('an ambiguous PostgreSQL failure triggers rollback before allowing backend startup', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([['old.txt', 'original']]),
  });
  try {
    const input = options(project, runtime);
    const runner = input.runCommand;
    let restoreCount = 0;
    input.runCommand = (command, args, commandOptions) => {
      if (args.includes('--clean') && ++restoreCount === 1)
        return {
          ok: false,
          stdout: '',
          stderr: 'connection lost during restore',
        };
      return runner(command, args, commandOptions);
    };
    const result = await runProductionRestore(input);
    assert.equal(result.ok, false);
    assert.equal(result.details.rollback.ok, true);
    assert.equal(restoreCount, 2);
    assert.equal(result.details.recoveryRequired, false);
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

test('failure to clear the marker is reported and keeps backend blocked after verified restore', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime();
  try {
    const input = options(project, runtime);
    input.operations.clearRestoreRecoveryState = () => {
      throw new Error('unlink denied');
    };
    const result = await runProductionRestore(input);
    assert.equal(result.ok, false);
    assert.equal(result.details.failedStage, 'Clearing restore recovery state');
    assert.equal(result.details.recoveryRequired, true);
    assert.throws(
      () =>
        locks.acquireInstallationLock({
          projectRoot: project.root,
          operation: 'backend',
        }),
      { code: 'INSTALLATION_RECOVERY_REQUIRED' },
    );
  } finally {
    await project.remove();
  }
});
