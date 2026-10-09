import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { verifyBackupChecksums } from '../../../scripts/prod/backup-integrity.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  createConfig,
  createPgRestoreRunner,
  createRestoreProject,
  createS3Runtime,
  createTestRuntime,
} from './helpers/restore-prod-helpers.mjs';

test('a partial MinIO restore failure retains a verified copy of the original database and files', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([
      ['old.txt', 'original-file'],
      ['manuals/manual.pdf', 'original-manual'],
    ]),
    putErrorAt: 1,
  });
  const calls = [];
  try {
    const result = await runProductionRestore({
      clock: () => new Date('2026-10-09T12:00:00Z'),
      ...createTestRuntime({
        argv: ['--backup', project.backupPath, '--confirm'],
        projectRoot: project.root,
        runCommand: createPgRestoreRunner({ calls }),
        runtimeDependencies: runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('CONFIG_OK', 'ok'),
        }),
      },
    });
    assert.equal(result.details.failedCode, 'MINIO_RESTORE_FAILED');
    assert.equal(result.details.postgresRestored, true);
    const recovery = result.details.recoveryBackupPath;
    const manifest = JSON.parse(
      await readFile(join(recovery, 'backup.json'), 'utf8'),
    );
    assert.equal(
      (await verifyBackupChecksums({ backupPath: recovery, manifest })).ok,
      true,
    );
    assert.equal(
      await readFile(join(recovery, 'database.dump'), 'utf8'),
      'current-database-dump',
    );
    assert.equal(
      await readFile(join(recovery, 'storage', 'old.txt'), 'utf8'),
      'original-file',
    );
    assert.equal(
      await readFile(
        join(recovery, 'storage', 'manuals', 'manual.pdf'),
        'utf8',
      ),
      'original-manual',
    );
    const firstDelete = runtime.calls.findIndex(
      (call) => call.type === 'delete',
    );
    assert.equal(
      runtime.calls.slice(0, firstDelete).filter((call) => call.type === 'get')
        .length,
      2,
    );
    assert.equal(result.details.rollback.ok, true);
    assert.deepEqual([...runtime.objects.entries()].sort(), [
      ['manuals/manual.pdf', 'original-manual'],
      ['old.txt', 'original-file'],
    ]);
    assert.ok(
      calls.findIndex((call) =>
        call.args.some((arg) => arg.startsWith('--file=')),
      ) < calls.findIndex((call) => call.args.includes('--clean')),
    );
    const rollback = await runProductionRestore({
      clock: () => new Date('2026-10-09T12:00:01Z'),
      ...createTestRuntime({
        argv: ['--backup', recovery, '--confirm'],
        projectRoot: project.root,
        runCommand: createPgRestoreRunner(),
        runtimeDependencies: runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('CONFIG_OK', 'ok'),
        }),
      },
    });
    assert.equal(rollback.ok, true);
    assert.deepEqual([...runtime.objects.entries()].sort(), [
      ['manuals/manual.pdf', 'original-manual'],
      ['old.txt', 'original-file'],
    ]);
  } finally {
    await project.remove();
  }
});

test('recovery backup failure prevents database and storage replacement', async () => {
  const project = await createRestoreProject();
  const runtime = createS3Runtime({
    objects: new Map([['old.txt', 'original']]),
  });
  const calls = [];
  const runner = createPgRestoreRunner({ calls });
  try {
    const result = await runProductionRestore({
      ...createTestRuntime({
        argv: ['--backup', project.backupPath, '--confirm'],
        projectRoot: project.root,
        runtimeDependencies: runtime.runtimeDependencies,
        runCommand: (command, args, options) =>
          command === 'pg_dump'
            ? { ok: false, stdout: '', stderr: 'pg_dump unavailable' }
            : runner(command, args, options),
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('CONFIG_OK', 'ok'),
        }),
      },
    });
    assert.equal(result.details.failedCode, 'RESTORE_RECOVERY_BACKUP_FAILED');
    assert.equal(result.details.postgresRestored, false);
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
    assert.equal(runtime.objects.get('old.txt'), 'original');
  } finally {
    await project.remove();
  }
});

test('the resolved configuration root is used for lock, package metadata and recovery fallback', async () => {
  const project = await createRestoreProject();
  const config = createConfig(project);
  config.backup.dir = null;
  const requestedRoot = join(project.root, 'unused-requested-root');
  try {
    const result = await runProductionRestore({
      ...createTestRuntime({
        argv: ['--backup', project.backupPath, '--confirm'],
        projectRoot: requestedRoot,
        runCommand: createPgRestoreRunner(),
      }),
      operations: {
        loadProductionConfig: () => ({
          config,
          projectRoot: project.root,
          result: success('CONFIG_OK', 'ok'),
        }),
        restorePostgresDatabase: async () => {
          await access(
            join(project.root, '.local', '.production-operation.lock'),
          );
          return success('POSTGRES_RESTORED', 'ok');
        },
      },
    });
    assert.equal(result.ok, true);
    const recovery = result.details.recoveryBackupPath;
    assert.equal(
      recovery.startsWith(
        join(project.root, '.local', 'restore-recovery') + '\\',
      ) ||
        recovery.startsWith(
          join(project.root, '.local', 'restore-recovery') + '/',
        ),
      true,
    );
    const manifest = JSON.parse(
      await readFile(join(recovery, 'backup.json'), 'utf8'),
    );
    assert.equal(manifest.appVersion, '0.0.1-test');
    await assert.rejects(access(requestedRoot), { code: 'ENOENT' });
  } finally {
    await project.remove();
  }
});
