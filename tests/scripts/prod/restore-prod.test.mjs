import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createConfig,
  createOutput,
  createPgRestoreRunner,
  createRestoreProject,
  createS3Runtime,
  createTestRuntime,
} from './helpers/restore-prod-helpers.mjs';

test('restore completes PostgreSQL and MinIO replacement', async () => {
  const project = await createRestoreProject();
  const commandCalls = [];
  const s3Runtime = createS3Runtime({
    objects: new Map([
      ['old-object.txt', 'old'],
      ['legacy/file.txt', 'legacy'],
    ]),
  });

  try {
    const result = await runProductionRestore({
      ...createTestRuntime({
        argv: ['--backup', project.backupPath, '--confirm'],
        projectRoot: project.root,
        runCommand: createPgRestoreRunner({ calls: commandCalls }),
        runtimeDependencies: s3Runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('RESTORE_CONFIG_OK', 'Production restore configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.code, 'RESTORE_OK');
    assert.equal(s3Runtime.objects.has('old-object.txt'), false);
    assert.equal(
      s3Runtime.objects.get('equipment/equipment_card/42/equipment_photo/photo.webp'),
      'photo-bytes',
    );
    for (const argument of [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--single-transaction',
    ]) {
      assert.equal(commandCalls[1].args.includes(argument), true);
    }

    assert.equal(commandCalls[1].args.some((arg) => arg.includes(SECRET_MARKERS[0])), false);
    assert.equal(commandCalls[1].options.env.PGPASSWORD, SECRET_MARKERS[0]);
    assertNoSecretLeak(result);
  } finally {
    await project.remove();
  }
});

test('restore requires explicit confirmation before any production checks', async () => {
  const calls = [];
  const result = await runProductionRestore({
    ...createTestRuntime({
      argv: ['--backup', 'C:/backups/2026-08-03_09-30-00'],
    }),
    operations: {
      loadProductionConfig: () => {
        calls.push('loadProductionConfig');
        return {
          result: success('RESTORE_CONFIG_OK', 'Production restore configuration is valid'),
        };
      },
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'RESTORE_CONFIRMATION_REQUIRED');
  assert.deepEqual(calls, []);
});

test('restore requires backup argument', async () => {
  const result = await runProductionRestore({
    ...createTestRuntime({
      argv: ['--confirm'],
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'RESTORE_BACKUP_REQUIRED');
});

test('restore maps thrown operation exceptions to normalized failure', async () => {
  const result = await runProductionRestore({
    ...createTestRuntime({
      argv: ['--backup', 'C:/backup', '--confirm'],
    }),
    operations: {
      loadProductionConfig: () => {
        throw new Error('boom');
      },
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'RESTORE_STAGE_FAILED');
});

test('restore stops before destructive stages when backup storage mismatches manifest', async () => {
  const project = await createRestoreProject({
    manifest: {
      formatVersion: 1,
      createdAt: '2026-08-03T09:30:00.000Z',
      appVersion: '0.0.1-test',
      database: {
        file: 'database.dump',
      },
      storage: {
        bucket: 'esoft',
        directory: 'storage',
        objectCount: 100,
        totalBytes: 'photo-bytes'.length + 'manual-bytes'.length,
      },
    },
  });
  const commandCalls = [];
  const s3Runtime = createS3Runtime({
    objects: new Map([['old.txt', 'old']]),
  });

  try {
    const result = await runProductionRestore({
      ...createTestRuntime({
        argv: ['--backup', project.backupPath, '--confirm'],
        projectRoot: project.root,
        runCommand: createPgRestoreRunner({ calls: commandCalls }),
        runtimeDependencies: s3Runtime.runtimeDependencies,
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('RESTORE_CONFIG_OK', 'Production restore configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedStage, 'Validating backup artifacts');
    assert.equal(result.details.failedCode, 'RESTORE_STORAGE_SUMMARY_MISMATCH');
    assert.equal(commandCalls.length, 0);
    assert.equal(s3Runtime.calls.length, 0);
  } finally {
    await project.remove();
  }
});

test('restore output and result redact secrets', async () => {
  const output = createOutput();
  const result = await runProductionRestore({
    ...createTestRuntime({
      argv: ['--backup', 'C:/backup', '--confirm'],
    }),
    output,
    operations: {
      loadProductionConfig: () => ({
        result: failure(
          'RESTORE_CONFIG_INVALID',
          `Production restore configuration is invalid DATABASE_URL=${SECRET_MARKERS[0]}`,
        ),
      }),
    },
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});
