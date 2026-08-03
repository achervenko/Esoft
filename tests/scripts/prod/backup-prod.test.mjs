import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createBackupProject,
  createConfig,
  createOutput,
  createPgDumpRunner,
  createS3Runtime,
  createTestRuntime,
} from './helpers/backup-prod-helpers.mjs';

test('backup creates database dump, MinIO files, manifest and final folder', async () => {
  const project = await createBackupProject();
  const runCommandCalls = [];
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['equipment/equipment_card/42/equipment_photo/photo.webp', 'photo-bytes'],
      ['users/user-1/photo/small/avatar.webp', 'avatar-bytes'],
    ]),
  });

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: createPgDumpRunner({ calls: runCommandCalls }),
        runtimeDependencies: s3Runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.code, 'BACKUP_OK');
    assert.equal(
      result.details.backupPath,
      join(project.root, 'backups', '2026-08-03_09-30-00'),
    );
    assert.equal(existsSync(result.details.backupPath), true);
    assert.equal(
      existsSync(join(project.root, 'backups', '.2026-08-03_09-30-00.incomplete')),
      false,
    );

    const dumpStat = await stat(join(result.details.backupPath, 'database.dump'));
    assert.equal(dumpStat.isFile(), true);
    assert.equal(dumpStat.size > 0, true);
    assert.equal(
      await readFile(
        join(
          result.details.backupPath,
          'storage/equipment/equipment_card/42/equipment_photo/photo.webp',
        ),
        'utf8',
      ),
      'photo-bytes',
    );
    assert.equal(
      await readFile(
        join(result.details.backupPath, 'storage/users/user-1/photo/small/avatar.webp'),
        'utf8',
      ),
      'avatar-bytes',
    );

    const manifest = JSON.parse(
      await readFile(join(result.details.backupPath, 'backup.json'), 'utf8'),
    );
    assert.deepEqual(manifest, {
      formatVersion: 1,
      createdAt: '2026-08-03T09:30:00.000Z',
      appVersion: '0.0.1-test',
      database: {
        file: 'database.dump',
      },
      storage: {
        bucket: 'esoft',
        directory: 'storage',
        objectCount: 2,
        totalBytes: 'photo-bytes'.length + 'avatar-bytes'.length,
      },
    });
    assertNoSecretLeak(manifest);
    assert.equal(runCommandCalls[0].args[0], '--version');
    assert.deepEqual(runCommandCalls[1].args, [
      '--format=custom',
      `--file=${join(project.root, 'backups', '.2026-08-03_09-30-00.incomplete', 'database.dump')}`,
    ]);
    assert.equal(runCommandCalls[1].options.env.PGPASSWORD, SECRET_MARKERS[0]);
  } finally {
    await project.remove();
  }
});

test('backup stops before filesystem work when production config is invalid', async () => {
  const calls = [];
  const result = await runProductionBackup({
    ...createTestRuntime(),
    operations: {
      loadProductionConfig: () => {
        calls.push('loadProductionConfig');
        return {
          result: failure(
            'PROD_CONFIG_INVALID',
            `Production configuration is invalid DATABASE_URL=${SECRET_MARKERS[0]}`,
          ),
        };
      },
      createBackupWorkspace: () => {
        calls.push('createBackupWorkspace');
        return success('BACKUP_DIRECTORY_READY', 'Backup directory is ready');
      },
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PROD_CONFIG_INVALID');
  assert.deepEqual(calls, ['loadProductionConfig']);
  assertNoSecretLeak(result);
});

test('backup cleans incomplete folder when pg_dump command fails', async () => {
  const project = await createBackupProject();
  const calls = [];

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: async (_command, args) => {
          if (args.includes('--version')) {
            return { ok: true, stdout: 'pg_dump 17' };
          }

          return { ok: false, code: 1, stderr: 'boom' };
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
        backupStorageBucket: () => {
          calls.push('backupStorageBucket');
          return success('MINIO_BACKUP_OK', 'MinIO bucket backup completed');
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_FAILED');
    assert.deepEqual(calls, []);
    assert.equal(
      existsSync(join(project.root, 'backups', '.2026-08-03_09-30-00.incomplete')),
      false,
    );
  } finally {
    await project.remove();
  }
});

test('backup ignores onStage observer errors and preserves cleanup flow', async () => {
  const project = await createBackupProject();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: async (_command, args) => {
          if (args.includes('--version')) {
            return { ok: true, stdout: 'pg_dump 17' };
          }

          return { ok: false, code: 1, stderr: 'pg dump failed' };
        },
      }),
      onStage: () => {
        throw new Error('observer failed');
      },
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'BACKUP_FAILED');
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_FAILED');
    assert.equal(
      existsSync(join(project.root, 'backups', '.2026-08-03_09-30-00.incomplete')),
      false,
    );
  } finally {
    await project.remove();
  }
});

test('backup preserves original failure when incomplete cleanup throws', async () => {
  const project = await createBackupProject();
  const output = createOutput();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        output,
        projectRoot: project.root,
        runCommand: async (_command, args) => {
          if (args.includes('--version')) {
            return { ok: true, stdout: 'pg_dump 17' };
          }

          return { ok: false, code: 1, stderr: 'pg dump failed' };
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
        cleanupIncompleteBackup: () => {
          throw new Error('cleanup failed');
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'BACKUP_FAILED');
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_FAILED');
    assert.equal(
      output.lines.includes('Incomplete backup cleanup failed.'),
      true,
    );
  } finally {
    await project.remove();
  }
});

test('backup preserves original failure when incomplete cleanup returns failure', async () => {
  const project = await createBackupProject();
  const output = createOutput();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        output,
        projectRoot: project.root,
        runCommand: async (_command, args) => {
          if (args.includes('--version')) {
            return { ok: true, stdout: 'pg_dump 17' };
          }

          return { ok: false, code: 1, stderr: 'pg dump failed' };
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
        cleanupIncompleteBackup: () =>
          failure('BACKUP_CLEANUP_FAILED', 'cleanup failed'),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_FAILED');
    assert.equal(
      output.lines.includes('Incomplete backup cleanup failed: cleanup failed'),
      true,
    );
  } finally {
    await project.remove();
  }
});

test('backup maps thrown operation exceptions to normalized failure', async () => {
  const result = await runProductionBackup({
    ...createTestRuntime(),
    operations: {
      loadProductionConfig: () => {
        throw new Error(`boom DATABASE_URL=${SECRET_MARKERS[0]}`);
      },
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'BACKUP_STAGE_FAILED');
  assertNoSecretLeak(result);
});

test('backup output and result redact secrets', async () => {
  const output = createOutput();
  const result = await runProductionBackup({
    ...createTestRuntime({ output }),
    operations: {
      loadProductionConfig: () => ({
        result: failure(
          'PROD_CONFIG_INVALID',
          `Production configuration is invalid DATABASE_URL=${SECRET_MARKERS[0]} MINIO_SECRET_KEY=${SECRET_MARKERS[1]}`,
        ),
      }),
    },
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});
