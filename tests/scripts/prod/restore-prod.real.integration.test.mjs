import assert from 'node:assert/strict';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import test from 'node:test';

import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import { createRealBackupEnvironment } from '../helpers/real-backup-environment.mjs';

test(
  'real PostgreSQL and MinIO backup, restore and automatic rollback',
  {
    skip: process.env.ESOFT_REAL_BACKUP_TEST !== '1',
    timeout: 120000,
  },
  async () => {
    const environment = await createRealBackupEnvironment();
    const { config, database, root, runtimeDependencies } = environment;
    const quiet = { log() {} };
    const base = {
      projectRoot: root,
      runtimeDependencies,
      output: quiet,
      operations: {
        loadProductionConfig: () => ({
          config,
          projectRoot: root,
          result: success('CONFIG_OK', 'ok'),
        }),
      },
    };
    try {
      await database.query(`CREATE TABLE probe (id SERIAL PRIMARY KEY, value TEXT NOT NULL UNIQUE);
      CREATE TABLE probe_child (id SERIAL PRIMARY KEY, parent_id INT NOT NULL REFERENCES probe(id));
      INSERT INTO probe(value) VALUES ('СИЗ — исходные данные');
      INSERT INTO probe_child(parent_id) VALUES (1);`);
      const original = Buffer.from([0, 1, 127, 128, 255]);
      await environment.put('documents/binary.bin', original);
      await environment.put('empty.txt', Buffer.alloc(0));
      const backup = await runProductionBackup({
        ...base,
        clock: () => new Date('2026-10-09T16:00:00Z'),
      });
      assert.equal(backup.ok, true, JSON.stringify(backup));
      await database.query(
        "UPDATE probe SET value = 'изменённые данные'; INSERT INTO probe(value) VALUES ('добавленная строка')",
      );
      await environment.put('documents/binary.bin', Buffer.from('changed'));
      await environment.put('extra.txt', Buffer.from('extra'));
      const restored = await runProductionRestore({
        ...base,
        argv: ['--backup', backup.details.backupPath, '--confirm'],
        clock: () => new Date('2026-10-09T16:00:01Z'),
      });
      assert.equal(restored.ok, true, JSON.stringify(restored));
      assert.deepEqual(
        (await database.query('SELECT id,value FROM probe ORDER BY id')).rows,
        [{ id: 1, value: 'СИЗ — исходные данные' }],
      );
      assert.equal(
        (await database.query('SELECT * FROM probe_child')).rowCount,
        1,
      );
      assert.equal(
        (
          await database.query(
            "INSERT INTO probe(value) VALUES ('sequence restored') RETURNING id",
          )
        ).rows[0].id,
        2,
      );
      assert.deepEqual(await environment.get('documents/binary.bin'), original);
      assert.equal((await environment.get('empty.txt')).length, 0);
      await assert.rejects(environment.get('extra.txt'));

      await database.query(
        "UPDATE probe SET value = 'до неудачного restore' WHERE id = 1",
      );
      const beforeFailedRestore = (
        await database.query('SELECT id,value FROM probe ORDER BY id')
      ).rows;
      await environment.put(
        'documents/binary.bin',
        Buffer.from('before-failure'),
      );
      await environment.put('extra.txt', Buffer.from('keep-me'));
      let puts = 0;
      class FailFirstUploadClient extends runtimeDependencies.S3Client {
        async send(command, ...args) {
          const result = await super.send(command, ...args);
          if (
            command instanceof runtimeDependencies.PutObjectCommand &&
            ++puts === 1
          )
            throw new Error('Injected failure after real MinIO upload');
          return result;
        }
      }
      const failed = await runProductionRestore({
        ...base,
        runtimeDependencies: {
          ...runtimeDependencies,
          S3Client: FailFirstUploadClient,
        },
        argv: ['--backup', backup.details.backupPath, '--confirm'],
        clock: () => new Date('2026-10-09T16:00:02Z'),
      });
      assert.equal(failed.ok, false);
      assert.equal(failed.details.rollback?.ok, true, JSON.stringify(failed));
      assert.deepEqual(
        (await database.query('SELECT id,value FROM probe ORDER BY id')).rows,
        beforeFailedRestore,
      );
      assert.equal(
        (await environment.get('documents/binary.bin')).toString(),
        'before-failure',
      );
      assert.equal((await environment.get('extra.txt')).toString(), 'keep-me');
      await assert.rejects(
        access(join(root, '.local', '.restore-recovery-required.json')),
        { code: 'ENOENT' },
      );
    } finally {
      await environment.close();
    }
  },
);
