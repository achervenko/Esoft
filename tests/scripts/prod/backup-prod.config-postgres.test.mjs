import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionBackup } from '../../../scripts/prod/backup-prod.mjs';
import { loadProductionBackupConfig } from '../../../scripts/prod/backup-prod.config.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import {
  createBackupProject,
  createConfig,
  createPgDumpRunner,
  createTestRuntime,
} from './helpers/backup-prod-helpers.mjs';

test('loadProductionBackupConfig requires BACKUP_DIR only for backup command', async () => {
  const loaded = await loadProductionBackupConfig({
    loadConfig: () => ({
      config: {
        backup: {
          dir: null,
        },
        nodeEnv: 'production',
      },
      envPath: 'C:/project/.env',
      projectRoot: 'C:/project',
    }),
    projectRoot: 'C:/project',
    validateConfig: () => ({
      envPath: 'C:/project/.env',
      errors: [],
      valid: true,
      warnings: [],
    }),
  });

  assertOperationResult(loaded.result, { ok: false });
  assert.equal(loaded.result.code, 'BACKUP_CONFIG_INVALID');
  assert.equal(loaded.result.details.variable, 'BACKUP_DIR');
});

test('loadProductionBackupConfig maps shared production config failures', async () => {
  const loaded = await loadProductionBackupConfig({
    projectRoot: 'C:/project',
    validateConfig: () => ({
      envPath: 'C:/project/.env',
      errors: [{ variable: 'DATABASE_URL', message: 'invalid database url' }],
      valid: false,
      warnings: [],
    }),
  });

  assertOperationResult(loaded.result, { ok: false });
  assert.equal(loaded.result.code, 'BACKUP_CONFIG_INVALID');
  assert.equal(loaded.result.details.causeCode, 'PROD_CONFIG_INVALID');
});

test('backup fails before MinIO copy when pg_dump is unavailable', async () => {
  const project = await createBackupProject();
  const calls = [];

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({ projectRoot: project.root }),
      operations: {
        loadProductionConfig: () => {
          calls.push('loadProductionConfig');
          return {
            config: createConfig(project),
            projectRoot: project.root,
            result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
          };
        },
        checkPgDumpAvailable: () => {
          calls.push('checkPgDumpAvailable');
          return failure('PG_DUMP_UNAVAILABLE', 'pg_dump is unavailable');
        },
        backupStorageBucket: () => {
          calls.push('backupStorageBucket');
          return success('MINIO_BACKUP_OK', 'MinIO bucket backup completed');
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'PG_DUMP_UNAVAILABLE');
    assert.deepEqual(calls, ['loadProductionConfig', 'checkPgDumpAvailable']);
    assert.equal(existsSync(join(project.root, 'backups')), false);
  } finally {
    await project.remove();
  }
});

test('backup reports PG_DUMP_UNAVAILABLE when pg_dump availability command throws', async () => {
  const project = await createBackupProject();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: async () => {
          throw new Error('spawn failed');
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'PG_DUMP_UNAVAILABLE');
  } finally {
    await project.remove();
  }
});

test('backup reports POSTGRES_BACKUP_FAILED when pg_dump backup command throws', async () => {
  const project = await createBackupProject();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: async (_command, args) => {
          if (args.includes('--version')) {
            return { ok: true, stdout: 'pg_dump 17' };
          }

          throw new Error('spawn failed');
        },
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_FAILED');
  } finally {
    await project.remove();
  }
});

test('backup fails when database.dump is missing after successful command', async () => {
  const project = await createBackupProject();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: async () => ({ ok: true, stdout: 'pg_dump 17' }),
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_MISSING');
    assert.equal(existsSync(join(project.root, 'backups', '2026-08-03_09-30-00')), false);
  } finally {
    await project.remove();
  }
});

test('backup fails when database.dump is empty', async () => {
  const project = await createBackupProject();

  try {
    const result = await runProductionBackup({
      ...createTestRuntime({
        projectRoot: project.root,
        runCommand: createPgDumpRunner({ dumpContent: '' }),
      }),
      operations: {
        loadProductionConfig: () => ({
          config: createConfig(project),
          projectRoot: project.root,
          result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
        }),
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.failedCode, 'POSTGRES_BACKUP_MISSING');
  } finally {
    await project.remove();
  }
});
