import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { success } from '../infrastructure/result.mjs';
import {
  createDefaultProductionRestoreContext,
  createDefaultProductionRestoreOperations,
  loadRuntimeDependencies,
} from './restore-prod.operations.mjs';
import {
  createProductionRestoreReporter,
  createProductionRestoreStageRunner,
  finishProductionRestoreFailure,
} from './restore-prod.reporter.mjs';

const STAGE_COUNT = 10;

export async function runProductionRestore(options = {}) {
  const output = options.output ?? console;
  const reporter = options.reporter ?? createProductionRestoreReporter({ output });
  const operations = {
    ...createDefaultProductionRestoreOperations(),
    ...(options.operations ?? {}),
  };
  const context = createDefaultProductionRestoreContext(options);
  const results = [];
  const restoreState = {};
  const stage = createProductionRestoreStageRunner({
    onStage: options.onStage,
    reporter,
    results,
    totalStages: STAGE_COUNT,
  });

  const argumentsStage = await stage(1, 'Parsing restore arguments', () =>
    operations.parseRestoreArguments(context.argv),
  );

  if (!argumentsStage.result.ok) {
    return fail({
      failedStage: 'Parsing restore arguments',
      reporter,
      restoreState,
      result: argumentsStage.result,
      results,
    });
  }

  restoreState.backupPath = argumentsStage.result.details.backupPath;
  reporter.notice?.();

  const configStage = await stage(
    2,
    'Validating production configuration',
    () =>
      operations.loadProductionConfig({
        projectRoot: context.projectRoot,
      }),
    (configuration) => configuration.result,
  );

  if (!configStage.result.ok) {
    return fail({
      failedStage: 'Validating production configuration',
      reporter,
      restoreState,
      result: configStage.result,
      results,
    });
  }

  const { config } = configStage.value;

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

  const pgRestoreStage = await stage(5, 'Checking pg_restore', () =>
    operations.checkPgRestoreAvailable({
      config,
      runCommand: context.runCommand,
    }),
  );

  if (!pgRestoreStage.result.ok) {
    return fail({
      failedStage: 'Checking pg_restore',
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

  const restorePostgresStage = await stage(8, 'Restoring PostgreSQL', () =>
    operations.restorePostgresDatabase({
      config,
      dumpPath,
      runCommand: context.runCommand,
    }),
  );

  if (!restorePostgresStage.result.ok) {
    return fail({
      failedStage: 'Restoring PostgreSQL',
      reporter,
      restoreState,
      result: restorePostgresStage.result,
      results,
    });
  }

  restoreState.postgresRestored = true;

  const storageStage = await stage(9, 'Replacing MinIO objects', () =>
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
    return fail({
      failedStage: 'Replacing MinIO objects',
      reporter,
      restoreState,
      result: storageStage.result,
      results,
    });
  }

  const verifyStage = await stage(10, 'Verifying restore', () =>
    operations.verifyRestoredStorage({
      config,
      expectedObjectCount: manifest.storage.objectCount,
      expectedTotalBytes: manifest.storage.totalBytes,
      ListObjectsV2Command: context.ListObjectsV2Command,
      S3Client: context.S3Client,
    }),
  );

  if (!verifyStage.result.ok) {
    return fail({
      failedStage: 'Verifying restore',
      reporter,
      restoreState,
      result: verifyStage.result,
      results,
    });
  }

  const finalResult = success('RESTORE_OK', 'Production restore completed', {
    backupPath: restoreState.backupPath,
    results,
  });
  reporter.success(finalResult);

  return finalResult;
}

function fail({
  failedStage,
  reporter,
  restoreState,
  result,
  results,
}) {
  return finishProductionRestoreFailure({
    failedStage,
    reporter,
    restoreState,
    result,
    results,
  });
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runProductionRestore({
    runtimeDependencies: loadRuntimeDependencies(),
  });

  process.exitCode = result.ok ? 0 : 1;
}
