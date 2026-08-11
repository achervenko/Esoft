import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionRestore } from '../../../scripts/prod/restore-prod.mjs';
import { success } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import {
  createConfig,
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
