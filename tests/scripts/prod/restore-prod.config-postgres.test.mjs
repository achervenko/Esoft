import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { loadProductionRestoreConfig } from '../../../scripts/prod/restore-prod.config.mjs';
import {
  checkPgRestoreAvailable,
  restorePostgresDatabase,
} from '../../../scripts/prod/restore-prod.postgres.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createConfig,
  createPgRestoreRunner,
  createRestoreProject,
} from './helpers/restore-prod-helpers.mjs';

test('loadProductionRestoreConfig maps shared production config failures', async () => {
  const loaded = await loadProductionRestoreConfig({
    projectRoot: 'C:/project',
    validateConfig: () => ({
      envPath: 'C:/project/.env',
      errors: [{ variable: 'DATABASE_URL', message: 'invalid database url' }],
      valid: false,
      warnings: [],
    }),
  });

  assertOperationResult(loaded.result, { ok: false });
  assert.equal(loaded.result.code, 'RESTORE_CONFIG_INVALID');
  assert.equal(loaded.result.details.causeCode, 'PROD_CONFIG_INVALID');
});

test('checkPgRestoreAvailable reports unavailable command results and throws', async () => {
  const project = await createRestoreProject();

  try {
    const failedResult = await checkPgRestoreAvailable({
      config: createConfig(project),
      runCommand: async () => ({ ok: false, code: 1, stderr: 'missing' }),
    });

    assertOperationResult(failedResult, { ok: false });
    assert.equal(failedResult.code, 'PG_RESTORE_UNAVAILABLE');

    const thrownResult = await checkPgRestoreAvailable({
      config: createConfig(project),
      runCommand: async () => {
        throw new Error('spawn failed');
      },
    });

    assertOperationResult(thrownResult, { ok: false });
    assert.equal(thrownResult.code, 'PG_RESTORE_UNAVAILABLE');
  } finally {
    await project.remove();
  }
});

test('restorePostgresDatabase runs pg_restore with safe args and PGPASSWORD env', async () => {
  const project = await createRestoreProject();
  const calls = [];

  try {
    const result = await restorePostgresDatabase({
      config: createConfig(project),
      dumpPath: join(project.backupPath, 'database.dump'),
      runCommand: createPgRestoreRunner({ calls }),
    });

    assertOperationResult(result, { ok: true });
    assert.equal(calls[0].args.includes('--clean'), true);
    assert.equal(calls[0].args.includes('--if-exists'), true);
    assert.equal(calls[0].args.includes('--no-owner'), true);
    assert.equal(calls[0].args.includes('--no-privileges'), true);
    assert.equal(calls[0].args.includes('--exit-on-error'), true);
    assert.equal(calls[0].args.includes('--single-transaction'), true);
    assert.equal(calls[0].args.includes('--dbname=esoft'), true);
    assert.equal(calls[0].options.env.PGPASSWORD, SECRET_MARKERS[0]);
    assert.equal(calls[0].args.some((arg) => arg.includes(SECRET_MARKERS[0])), false);
    assertNoSecretLeak(result);
  } finally {
    await project.remove();
  }
});

test('restorePostgresDatabase normalizes command failure and exceptions', async () => {
  const project = await createRestoreProject();

  try {
    const failedResult = await restorePostgresDatabase({
      config: createConfig(project),
      dumpPath: join(project.backupPath, 'database.dump'),
      runCommand: async () => ({
        ok: false,
        code: 1,
        stderr: `failed ${SECRET_MARKERS[0]}`,
      }),
    });

    assertOperationResult(failedResult, { ok: false });
    assert.equal(failedResult.code, 'POSTGRES_RESTORE_FAILED');
    assertNoSecretLeak(failedResult);

    const thrownResult = await restorePostgresDatabase({
      config: createConfig(project),
      dumpPath: join(project.backupPath, 'database.dump'),
      runCommand: async () => {
        throw new Error(`spawn failed ${SECRET_MARKERS[0]}`);
      },
    });

    assertOperationResult(thrownResult, { ok: false });
    assert.equal(thrownResult.code, 'POSTGRES_RESTORE_FAILED');
    assertNoSecretLeak(thrownResult);
  } finally {
    await project.remove();
  }
});
