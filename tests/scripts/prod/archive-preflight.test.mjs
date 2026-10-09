import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { verifyPostgresArchive } from '../../../scripts/infrastructure/postgres/archive.mjs';
import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  createBackupProject,
  createConfig as backupConfig,
  createPgDumpRunner,
  createS3Runtime as backupS3,
  createTestRuntime as backupRuntime,
} from './helpers/backup-prod-helpers.mjs';
import {
  createRestoreProject,
  createConfig as restoreConfig,
  createS3Runtime as restoreS3,
  createTestRuntime as restoreRuntime,
} from './helpers/restore-prod-helpers.mjs';

test('archive inspection uses configured pg_restore without a database connection', async () => {
  const result = await verifyPostgresArchive({
    config: { backup: { pgRestorePath: 'C:/PostgreSQL/bin/pg_restore.exe' } },
    dumpPath: 'C:/backups/database.dump',
    runCommand: async (command, args, options) => {
      assert.equal(command, 'C:/PostgreSQL/bin/pg_restore.exe');
      assert.deepEqual(args, ['--list', 'C:/backups/database.dump']);
      assert.equal(options.timeoutMs, 30_000);
      return { ok: true };
    },
  });
  assert.equal(result.code, 'POSTGRES_ARCHIVE_READABLE');
});

for (const outcome of ['rejected', 'timeout', 'unavailable']) {
  test(`archive inspection fails safely when pg_restore is ${outcome}`, async () => {
    const result = await verifyPostgresArchive({
      config: {},
      dumpPath: 'database.dump',
      runCommand: async () => {
        if (outcome === 'unavailable') throw new Error('Executable unavailable');
        return { ok: false, code: 1, timedOut: outcome === 'timeout', stderr: 'Invalid archive' };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'POSTGRES_ARCHIVE_UNREADABLE');
  });
}

test('backup rejects a nonempty unreadable dump before copying MinIO', async () => {
  const project = await createBackupProject();
  const storage = backupS3();
  const dumpRunner = createPgDumpRunner();
  try {
    const result = await runProductionBackup({
      ...backupRuntime({
        projectRoot: project.root,
        runtimeDependencies: storage.runtimeDependencies,
        runCommand: (command, args, options) => args.includes('--list')
          ? Promise.resolve({ ok: false, code: 1, stderr: 'Not a valid archive' })
          : dumpRunner(command, args, options),
      }),
      operations: {
        loadProductionConfig: () => ({
          config: backupConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Valid configuration'),
        }),
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.details.failedCode, 'POSTGRES_ARCHIVE_UNREADABLE');
    assert.equal(storage.calls.length, 0);
  } finally {
    await project.remove();
  }
});

test('restore rejects a nonempty unreadable dump before database or MinIO operations', async () => {
  const project = await createRestoreProject();
  const storage = restoreS3();
  const commands = [];
  try {
    const result = await runProductionRestore({
      ...restoreRuntime({
        projectRoot: project.root,
        argv: ['--backup', project.backupPath, '--confirm'],
        runtimeDependencies: {
          ...storage.runtimeDependencies,
          PgClient: class {
            constructor() { throw new Error('Database must not be accessed'); }
          },
        },
        runCommand: async (_command, args) => {
          commands.push(args);
          return args.includes('--version')
            ? { ok: true, stdout: 'pg_restore 17' }
            : { ok: false, code: 1, stderr: 'Not a valid archive' };
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: restoreConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Valid configuration'),
        }),
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.details.failedCode, 'POSTGRES_ARCHIVE_UNREADABLE');
    assert.deepEqual(commands, [['--version'], ['--list', join(project.backupPath, 'database.dump')]]);
    assert.equal(storage.calls.length, 0);
  } finally {
    await project.remove();
  }
});
