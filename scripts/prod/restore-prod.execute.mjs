import { success } from '../infrastructure/result.mjs';
import { finishProductionRestoreFailure as fail } from './restore-prod.reporter.mjs';
import { rollbackAndFail } from './restore-prod.rollback.mjs';

export async function executeProductionRestore({
  config,
  projectRoot,
  restoreState,
  operations,
  context,
  stage,
  reporter,
  results,
}) {
  const manifestStage = await stage(3, 'Reading backup manifest', () =>
    operations.readRestoreManifest({
      backupPath: restoreState.backupPath,
      config,
    }),
  );

  if (!manifestStage.result.ok) {
    return fail({
      failedStage: 'Reading backup manifest',
      reporter,
      restoreState,
      result: manifestStage.result,
      results,
    });
  }

  const manifest = manifestStage.result.details.manifest;

  const artifactsStage = await stage(4, 'Validating backup artifacts', () =>
    operations.validateRestoreArtifacts({
      backupPath: restoreState.backupPath,
      manifest,
      expectedObjectCount: manifest.storage.objectCount,
      expectedTotalBytes: manifest.storage.totalBytes,
    }),
  );

  if (!artifactsStage.result.ok) {
    return fail({
      failedStage: 'Validating backup artifacts',
      reporter,
      restoreState,
      result: artifactsStage.result,
      results,
    });
  }

  const { dumpPath, storagePath } = artifactsStage.result.details;

  const pgRestoreStage = await stage(
    5,
    'Checking pg_restore and archive',
    async () => {
      const available = await operations.checkPgRestoreAvailable({
        config,
        runCommand: context.runCommand,
      });
      if (!available.ok) return available;
      return operations.verifyPostgresArchive({
        config,
        dumpPath,
        runCommand: context.runCommand,
      });
    },
  );

  if (!pgRestoreStage.result.ok) {
    return fail({
      failedStage: 'Checking pg_restore and archive',
      reporter,
      restoreState,
      result: pgRestoreStage.result,
      results,
    });
  }

  const postgresStage = await stage(6, 'Checking PostgreSQL connection', () =>
    operations.checkProductionPostgres({
      config,
      PgClient: context.PgClient,
    }),
  );

  if (!postgresStage.result.ok) {
    return fail({
      failedStage: 'Checking PostgreSQL connection',
      reporter,
      restoreState,
      result: postgresStage.result,
      results,
    });
  }

  const bucketStage = await stage(7, 'Checking MinIO bucket', () =>
    operations.checkStorageBucket({
      config,
      HeadBucketCommand: context.HeadBucketCommand,
      S3Client: context.S3Client,
    }),
  );

  if (!bucketStage.result.ok) {
    return fail({
      failedStage: 'Checking MinIO bucket',
      reporter,
      restoreState,
      result: bucketStage.result,
      results,
    });
  }

  const recoveryStage = await stage(
    8,
    'Creating pre-restore recovery backup',
    () =>
      operations.createRestoreRecoveryBackup({ config, projectRoot, context }),
  );
  if (!recoveryStage.result.ok) {
    return fail({
      failedStage: 'Creating pre-restore recovery backup',
      reporter,
      restoreState,
      result: recoveryStage.result,
      results,
    });
  }
  restoreState.recoveryBackupPath =
    recoveryStage.result.details.recoveryBackupPath;
  reporter.info?.(
    `Pre-restore recovery backup: ${restoreState.recoveryBackupPath}`,
  );

  const recoveryStateStage = await stage(
    9,
    'Recording restore recovery state',
    async () => {
      await operations.writeRestoreRecoveryState({
        projectRoot,
        backupPath: restoreState.backupPath,
        recoveryBackupPath: restoreState.recoveryBackupPath,
      });
      return success(
        'RESTORE_RECOVERY_STATE_RECORDED',
        'Restore recovery state recorded',
      );
    },
  );
  if (!recoveryStateStage.result.ok)
    return fail({
      failedStage: 'Recording restore recovery state',
      reporter,
      restoreState,
      result: recoveryStateStage.result,
      results,
    });
  restoreState.recoveryRequired = true;

  const restorePostgresStage = await stage(10, 'Restoring PostgreSQL', () =>
    operations.restorePostgresDatabase({
      config,
      dumpPath,
      runCommand: context.runCommand,
    }),
  );

  if (!restorePostgresStage.result.ok) {
    return rollbackAndFail({
      config,
      projectRoot,
      context,
      operations,
      failedStage: 'Restoring PostgreSQL',
      reporter,
      restoreState,
      result: restorePostgresStage.result,
      results,
    });
  }

  restoreState.postgresRestored = true;

  const storageStage = await stage(11, 'Replacing MinIO objects', () =>
    operations.replaceStorageBucket({
      config,
      DeleteObjectCommand: context.DeleteObjectCommand,
      ListObjectsV2Command: context.ListObjectsV2Command,
      PutObjectCommand: context.PutObjectCommand,
      S3Client: context.S3Client,
      storagePath,
    }),
  );

  if (!storageStage.result.ok) {
    return rollbackAndFail({
      config,
      projectRoot,
      context,
      operations,
      failedStage: 'Replacing MinIO objects',
      reporter,
      restoreState,
      result: storageStage.result,
      results,
    });
  }

  const verifyStage = await stage(12, 'Verifying restore', async () => {
    const summary = await operations.verifyRestoredStorage({
      config,
      expectedObjectCount: manifest.storage.objectCount,
      expectedTotalBytes: manifest.storage.totalBytes,
      ListObjectsV2Command: context.ListObjectsV2Command,
      S3Client: context.S3Client,
    });
    if (!summary.ok) return summary;
    return operations.verifyRestoredStorageContents({
      config,
      manifest,
      GetObjectCommand: context.GetObjectCommand,
      ListObjectsV2Command: context.ListObjectsV2Command,
      S3Client: context.S3Client,
    });
  });

  if (!verifyStage.result.ok) {
    return rollbackAndFail({
      config,
      projectRoot,
      context,
      operations,
      failedStage: 'Verifying restore',
      reporter,
      restoreState,
      result: verifyStage.result,
      results,
    });
  }

  const clearStateStage = await stage(
    13,
    'Clearing restore recovery state',
    async () => {
      await operations.clearRestoreRecoveryState({ projectRoot });
      return success(
        'RESTORE_RECOVERY_STATE_CLEARED',
        'Restore recovery state cleared',
      );
    },
  );
  if (!clearStateStage.result.ok)
    return fail({
      failedStage: 'Clearing restore recovery state',
      reporter,
      restoreState,
      result: clearStateStage.result,
      results,
    });
  restoreState.recoveryRequired = false;

  const finalResult = success('RESTORE_OK', 'Production restore completed', {
    backupPath: restoreState.backupPath,
    recoveryBackupPath: restoreState.recoveryBackupPath,
    results,
  });
  reporter.success(finalResult);

  return finalResult;
}
