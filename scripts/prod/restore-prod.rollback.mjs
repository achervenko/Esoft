import { finishProductionRestoreFailure as fail } from './restore-prod.reporter.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function rollbackProductionRestore({
  config,
  context,
  operations,
  recoveryBackupPath,
  reporter,
}) {
  const results = [];
  let manifest;
  let artifacts;
  const steps = [
    [
      'Reading recovery manifest',
      async () => {
        const result = await operations.readRestoreManifest({
          backupPath: recoveryBackupPath,
          config,
        });
        if (result.ok) manifest = result.details.manifest;
        return result;
      },
    ],
    [
      'Validating recovery artifacts',
      async () => {
        const result = await operations.validateRestoreArtifacts({
          backupPath: recoveryBackupPath,
          manifest,
          expectedObjectCount: manifest.storage.objectCount,
          expectedTotalBytes: manifest.storage.totalBytes,
        });
        if (result.ok) artifacts = result.details;
        return result;
      },
    ],
    [
      'Checking recovery archive',
      () =>
        operations.verifyPostgresArchive({
          config,
          dumpPath: artifacts.dumpPath,
          runCommand: context.runCommand,
        }),
    ],
    [
      'Rolling back PostgreSQL',
      () =>
        operations.restorePostgresDatabase({
          config,
          dumpPath: artifacts.dumpPath,
          runCommand: context.runCommand,
        }),
    ],
    [
      'Rolling back MinIO',
      () =>
        operations.replaceStorageBucket({
          config,
          storagePath: artifacts.storagePath,
          ...context,
        }),
    ],
    [
      'Verifying rollback',
      async () => {
        const summary = await operations.verifyRestoredStorage({
          config,
          expectedObjectCount: manifest.storage.objectCount,
          expectedTotalBytes: manifest.storage.totalBytes,
          ...context,
        });
        if (!summary.ok) return summary;
        return operations.verifyRestoredStorageContents({
          config,
          manifest,
          ...context,
        });
      },
    ],
  ];
  for (const [label, run] of steps) {
    reporter.info?.(`Rollback: ${label}`);
    let result;
    try {
      result = await run();
    } catch (error) {
      result = failure('RESTORE_ROLLBACK_STAGE_FAILED', `${label} failed`, {
        error: formatError(error),
      });
    }
    results.push({ label, result });
    if (!result.ok)
      return failure(
        'RESTORE_ROLLBACK_FAILED',
        'Automatic rollback failed; backend must remain stopped',
        { failedStage: label, recoveryBackupPath, results },
      );
  }
  return success(
    'RESTORE_ROLLBACK_OK',
    'Original database and storage restored',
    { recoveryBackupPath, results },
  );
}

export async function rollbackAndFail({
  config,
  projectRoot,
  context,
  operations,
  failedStage,
  reporter,
  restoreState,
  result,
  results,
}) {
  let rollback;
  try {
    rollback = await operations.rollbackProductionRestore({
      config,
      context,
      operations,
      recoveryBackupPath: restoreState.recoveryBackupPath,
      reporter,
    });
  } catch (error) {
    rollback = failure(
      'RESTORE_ROLLBACK_FAILED',
      'Automatic rollback failed; backend must remain stopped',
      { error: formatError(error) },
    );
  }
  restoreState.rollback = rollback;
  if (rollback.ok) {
    try {
      await operations.clearRestoreRecoveryState({ projectRoot });
      restoreState.recoveryRequired = false;
    } catch {
      return fail({
        failedStage: 'Clearing rollback recovery state',
        reporter,
        restoreState,
        result: {
          ok: false,
          code: 'RESTORE_RECOVERY_STATE_CLEAR_FAILED',
          message:
            'Rollback succeeded but recovery marker could not be cleared; backend remains blocked',
        },
        results,
      });
    }
    reporter.info?.(
      'Automatic rollback completed. Original PostgreSQL and MinIO state restored.',
    );
  }
  return fail({
    failedStage,
    reporter,
    restoreState,
    result: rollback.ok ? result : rollback,
    results,
  });
}
