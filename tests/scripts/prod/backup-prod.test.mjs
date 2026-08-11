import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createBackupProject,
  createConfig,
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
