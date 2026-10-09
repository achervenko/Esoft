import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { rm } from 'node:fs/promises';
import { validateRestoreArtifacts } from '../../../scripts/prod/restore-prod.filesystem.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createRestoreProject } from './helpers/restore-prod-helpers.mjs';

test('validateRestoreArtifacts rejects missing or invalid dump and storage', async () => {
  const missingDumpProject = await createRestoreProject({ dumpContent: null });
  const emptyDumpProject = await createRestoreProject({ dumpContent: '' });
  const missingStorageProject = await createRestoreProject({ storageFiles: null });

  try {
    const missingDumpResult = await validateRestoreArtifacts({
      backupPath: missingDumpProject.backupPath,
    });
    assertOperationResult(missingDumpResult, { ok: false });

    const emptyDumpResult = await validateRestoreArtifacts({
      backupPath: emptyDumpProject.backupPath,
    });
    assertOperationResult(emptyDumpResult, { ok: false });
    assert.equal(emptyDumpResult.code, 'RESTORE_DUMP_INVALID');

    await rm(join(missingStorageProject.backupPath, 'storage'), {
      force: true,
      recursive: true,
    });
    const missingStorageResult = await validateRestoreArtifacts({
      backupPath: missingStorageProject.backupPath,
    });
    assertOperationResult(missingStorageResult, { ok: false });
  } finally {
    await missingDumpProject.remove();
    await emptyDumpProject.remove();
    await missingStorageProject.remove();
  }
});

test('validateRestoreArtifacts verifies storage summary against manifest values', async () => {
  const project = await createRestoreProject();

  try {
    const countResult = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      expectedObjectCount: 100,
      expectedTotalBytes: 'photo-bytes'.length + 'manual-bytes'.length,
    });
    assertOperationResult(countResult, { ok: false });
    assert.equal(countResult.code, 'RESTORE_STORAGE_SUMMARY_MISMATCH');
    assert.equal(countResult.details.actualObjectCount, 2);

    const sizeResult = await validateRestoreArtifacts({
      backupPath: project.backupPath,
      expectedObjectCount: 2,
      expectedTotalBytes: 100,
    });
    assertOperationResult(sizeResult, { ok: false });
    assert.equal(sizeResult.code, 'RESTORE_STORAGE_SUMMARY_MISMATCH');
    assert.equal(
      sizeResult.details.actualTotalBytes,
      'photo-bytes'.length + 'manual-bytes'.length,
    );
  } finally {
    await project.remove();
  }
});
