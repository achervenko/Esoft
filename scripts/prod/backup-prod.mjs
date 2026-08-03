import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { success } from '../infrastructure/result.mjs';
import {
  createDefaultProductionBackupContext,
  createDefaultProductionBackupOperations,
  loadRuntimeDependencies,
} from './backup-prod.operations.mjs';
import {
  createProductionBackupReporter,
  createProductionBackupStageRunner,
  finishProductionBackupFailure,
} from './backup-prod.reporter.mjs';

const STAGE_COUNT = 9;

export async function runProductionBackup(options = {}) {
  const output = options.output ?? console;
  const reporter = options.reporter ?? createProductionBackupReporter({ output });
  const operations = {
    ...createDefaultProductionBackupOperations(),
    ...(options.operations ?? {}),
  };
  const context = createDefaultProductionBackupContext(options);
  const results = [];
  const stage = createProductionBackupStageRunner({
    onStage: options.onStage,
    reporter,
    results,
    totalStages: STAGE_COUNT,
  });
  const backupState = {};

  reporter.notice?.();

  const configStage = await stage(
    1,
    'Validating production backup configuration',
    () =>
      operations.loadProductionConfig({
        projectRoot: context.projectRoot,
      }),
    (configuration) => configuration.result,
  );

  if (!configStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Validating production backup configuration',
      operations,
      reporter,
      result: configStage.result,
      results,
    });
  }

  const { config, projectRoot } = configStage.value;
  const backupRoot = config.backup.dir;
  const createdAt = context.clock();

  const pgDumpStage = await stage(2, 'Checking pg_dump', () =>
    operations.checkPgDumpAvailable({
      config,
      runCommand: context.runCommand,
    }),
  );

  if (!pgDumpStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Checking pg_dump',
      operations,
      reporter,
      result: pgDumpStage.result,
      results,
    });
  }

  const workspaceStage = await stage(3, 'Creating backup workspace', () =>
    operations.createBackupWorkspace({
      backupRoot,
      clock: () => createdAt,
    }),
  );

  if (!workspaceStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Creating backup workspace',
      operations,
      reporter,
      result: workspaceStage.result,
      results,
    });
  }

  Object.assign(backupState, workspaceStage.result.details);
  const dumpPath = resolve(backupState.incompletePath, 'database.dump');
  const storagePath = resolve(backupState.incompletePath, 'storage');
  const manifestPath = resolve(backupState.incompletePath, 'backup.json');

  const databaseStage = await stage(4, 'Backing up PostgreSQL', () =>
    operations.backupPostgresDatabase({
      config,
      dumpPath,
      runCommand: context.runCommand,
    }),
  );

  if (!databaseStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Backing up PostgreSQL',
      operations,
      reporter,
      result: databaseStage.result,
      results,
    });
  }

  const verifyDatabaseStage = await stage(5, 'Verifying PostgreSQL backup', () =>
    operations.verifyDatabaseDump({ dumpPath }),
  );

  if (!verifyDatabaseStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Verifying PostgreSQL backup',
      operations,
      reporter,
      result: verifyDatabaseStage.result,
      results,
    });
  }

  const bucketStage = await stage(6, 'Checking MinIO bucket', () =>
    operations.checkStorageBucket({
      config,
      HeadBucketCommand: context.HeadBucketCommand,
      S3Client: context.S3Client,
    }),
  );

  if (!bucketStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Checking MinIO bucket',
      operations,
      reporter,
      result: bucketStage.result,
      results,
    });
  }

  const storageStage = await stage(7, 'Backing up MinIO objects', () =>
    operations.backupStorageBucket({
      config,
      GetObjectCommand: context.GetObjectCommand,
      ListObjectsV2Command: context.ListObjectsV2Command,
      S3Client: context.S3Client,
      storagePath,
    }),
  );

  if (!storageStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Backing up MinIO objects',
      operations,
      reporter,
      result: storageStage.result,
      results,
    });
  }

  reporter.info?.(
    `Objects: ${storageStage.result.details.objectCount}; Size: ${storageStage.result.details.totalBytes} bytes`,
  );

  const versionStage = await stage(8, 'Writing backup manifest', async () => {
    const appVersion = await operations.loadAppVersion({ projectRoot });

    if (!appVersion.ok) {
      return appVersion;
    }

    return operations.writeBackupManifest({
      appVersion: appVersion.details.appVersion,
      config,
      createdAt,
      manifestPath,
      storageSummary: storageStage.result.details,
    });
  });

  if (!versionStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Writing backup manifest',
      operations,
      reporter,
      result: versionStage.result,
      results,
    });
  }

  const finalizeStage = await stage(9, 'Finalizing backup', async () => {
    const verify = await operations.verifyBackupArtifacts({
      backupPath: backupState.incompletePath,
      dumpPath,
      manifestPath,
      storagePath,
    });

    if (!verify.ok) {
      return verify;
    }

    return operations.finalizeBackup({
      finalPath: backupState.finalPath,
      incompletePath: backupState.incompletePath,
    });
  });

  if (!finalizeStage.result.ok) {
    return fail({
      backupState,
      failedStage: 'Finalizing backup',
      operations,
      reporter,
      result: finalizeStage.result,
      results,
    });
  }

  const finalResult = success('BACKUP_OK', 'Production backup completed', {
    backupPath: backupState.finalPath,
    results,
  });
  reporter.success(finalResult);

  return finalResult;
}

async function fail({
  backupState,
  failedStage,
  operations,
  reporter,
  result,
  results,
}) {
  if (backupState.incompletePath) {
    try {
      const cleanupResult = await operations.cleanupIncompleteBackup({
        incompletePath: backupState.incompletePath,
      });

      if (cleanupResult && !cleanupResult.ok) {
        reporter.info?.(
          `Incomplete backup cleanup failed: ${cleanupResult.message}`,
        );
      }
    } catch (error) {
      reporter.info?.('Incomplete backup cleanup failed.');
    }
  }

  return finishProductionBackupFailure({
    backupState,
    failedStage,
    reporter,
    result,
    results,
  });
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runProductionBackup({
    runtimeDependencies: loadRuntimeDependencies(),
  });

  process.exitCode = result.ok ? 0 : 1;
}
