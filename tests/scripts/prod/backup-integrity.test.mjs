import assert from 'node:assert/strict';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { verifyBackupChecksums } from '../../../scripts/prod/backup-integrity.mjs';
import { writeBackupManifest } from '../../../scripts/prod/backup-prod.manifest.mjs';
import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  createConfig,
  createManifest,
  createRestoreProject,
  createS3Runtime,
  createTestRuntime,
} from './helpers/restore-prod-helpers.mjs';

test('manifest generation hashes actual files and verification matches contents', async () => {
  const project = await createRestoreProject();
  try {
    const manifestPath = join(project.backupPath, 'backup.json');
    const result = await writeBackupManifest({
      config: createConfig(project),
      appVersion: 'test',
      createdAt: new Date('2026-10-09T00:00:00Z'),
      manifestPath,
      storageSummary: { objectCount: 2, totalBytes: 23 },
    });
    assert.equal(result.ok, true);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.formatVersion, 2);
    assert.deepEqual(manifest.database, createManifest().database);
    assert.deepEqual(
      manifest.storage.objects,
      createManifest().storage.objects,
    );
    assert.equal(
      (
        await verifyBackupChecksums({
          backupPath: project.backupPath,
          manifest,
        })
      ).ok,
      true,
    );
  } finally {
    await project.remove();
  }
});

for (const corruption of [
  'dump',
  'object',
  'renamed key',
  'swapped contents',
]) {
  test(`restore rejects ${corruption} corruption before external operations`, async () => {
    const project = await createRestoreProject();
    const storage = createS3Runtime();
    let commands = 0;
    try {
      const dump = join(project.backupPath, 'database.dump');
      const photo = join(
        project.backupPath,
        'storage/equipment/equipment_card/42/equipment_photo/photo.webp',
      );
      const manual = join(project.backupPath, 'storage/manuals/manual.pdf');
      if (corruption === 'dump') await writeFile(dump, 'damp');
      if (corruption === 'object') await writeFile(photo, 'PHOTO-bytes');
      if (corruption === 'renamed key')
        await rename(
          manual,
          join(project.backupPath, 'storage/manuals/other.pdf'),
        );
      if (corruption === 'swapped contents') {
        await writeFile(photo, 'manual-bytes');
        await writeFile(manual, 'photo-bytes');
      }
      const result = await runProductionRestore({
        ...createTestRuntime({
          projectRoot: project.root,
          argv: ['--backup', project.backupPath, '--confirm'],
          runtimeDependencies: storage.runtimeDependencies,
          runCommand: async () => {
            commands++;
            throw new Error('Command must not run');
          },
        }),
        output: { log() {} },
        operations: {
          loadProductionConfig: () => ({
            config: createConfig(project),
            projectRoot: project.root,
            result: success('PROD_CONFIG_OK', 'Valid configuration'),
          }),
        },
      });
      assert.equal(result.ok, false);
      assert.equal(result.details.failedCode, 'BACKUP_CHECKSUM_MISMATCH');
      assert.equal(commands, 0);
      assert.equal(storage.calls.length, 0);
    } finally {
      await project.remove();
    }
  });
}

test('missing, malformed or duplicate checksum entries cannot bypass verification', async () => {
  const project = await createRestoreProject();
  try {
    const valid = createManifest();
    for (const manifest of [
      undefined,
      { ...valid, formatVersion: 1 },
      { ...valid, database: { ...valid.database, sha256: 'invalid' } },
      { ...valid, storage: { ...valid.storage, objects: undefined } },
      {
        ...valid,
        storage: {
          ...valid.storage,
          objects: [valid.storage.objects[0], valid.storage.objects[0]],
        },
      },
      {
        ...valid,
        storage: {
          ...valid.storage,
          objects: [{ ...valid.storage.objects[0], key: '../escape' }],
        },
      },
    ]) {
      const result = await verifyBackupChecksums({
        backupPath: project.backupPath,
        manifest,
      });
      assert.equal(result.code, 'BACKUP_CHECKSUMS_INVALID');
    }
  } finally {
    await project.remove();
  }
});

for (const storageFiles of [{ 'empty.txt': '' }, {}]) {
  test(`zero-byte storage is supported with ${Object.keys(storageFiles).length} objects`, async () => {
    const project = await createRestoreProject({
      storageFiles,
    });
    try {
      const manifestPath = join(project.backupPath, 'backup.json');
      const result = await writeBackupManifest({
        config: createConfig(project),
        appVersion: 'test',
        createdAt: new Date(),
        manifestPath,
        storageSummary: {
          objectCount: Object.keys(storageFiles).length,
          totalBytes: 0,
        },
      });
      assert.equal(result.ok, true);
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      assert.equal(
        (
          await verifyBackupChecksums({
            backupPath: project.backupPath,
            manifest,
          })
        ).ok,
        true,
      );
    } finally {
      await project.remove();
    }
  });
}
