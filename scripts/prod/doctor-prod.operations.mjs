import { createRequire } from 'node:module';
import { readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { npmCommandName } from '../infrastructure/commands/npm-command.mjs';
import { checkMinioBucket } from '../infrastructure/minio/bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import { checkPostgresConnection } from '../infrastructure/postgres/connection.mjs';
import { terminatePgClient } from '../infrastructure/postgres/pg-client-terminator.mjs';
import { checkPrismaMigrationStatus } from '../infrastructure/prisma/migrations.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import { loadProductionConfig } from './setup-prod.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultProjectRoot = resolve(__dirname, '../..');

export function createDefaultProductionDoctorOperations() {
  return {
    loadProductionConfig: (params) =>
      loadProductionConfig({
        ...params,
        applyToProcessEnv: false,
      }),
    checkPostgresConnection: ({ config, PgClient }) =>
      checkPostgresConnection({
        config,
        PgClient,
        terminateClient: terminatePgClient,
      }),
    checkPrismaMigrationStatus,
    checkStorageBucket,
    checkBackendBuild,
    checkFrontendBuild,
  };
}

export function createDefaultProductionDoctorContext(options = {}) {
  return {
    npm: options.npm ?? npmCommandName(),
    projectRoot: options.projectRoot ?? defaultProjectRoot,
    runCommand: options.runCommand ?? runCommand,
    ...options.runtimeDependencies,
  };
}

export function loadRuntimeDependencies(projectRoot = defaultProjectRoot) {
  const backendRequire = createRequire(
    resolve(projectRoot, 'backend/package.json'),
  );
  const { Client: PgClient } = backendRequire('pg');
  const { HeadBucketCommand, S3Client } = backendRequire('@aws-sdk/client-s3');

  return {
    HeadBucketCommand,
    PgClient,
    S3Client,
  };
}

async function checkStorageBucket({ config, HeadBucketCommand, S3Client }) {
  const client = createS3Client({ config, S3Client });

  try {
    const result = await checkMinioBucket({
      bucket: config.minio.bucket,
      client,
      HeadBucketCommand,
    });

    if (result.code === 'MINIO_BUCKET_MISSING') {
      return failure(
        result.code,
        'MinIO bucket is missing. Run npm run setup:prod.',
        result.details,
      );
    }

    return result;
  } catch (error) {
    return failure('MINIO_BUCKET_CHECK_FAILED', 'Unable to check MinIO bucket', {
      error: formatError(error),
    });
  } finally {
    client.destroy();
  }
}

export async function checkBackendBuild({ projectRoot }) {
  const entryPath = resolve(projectRoot, 'backend/dist/src/main.js');

  try {
    const entryStat = await stat(entryPath);

    if (!entryStat.isFile()) {
      return failure(
        'PROD_BACKEND_BUILD_MISSING',
        'Backend production build entrypoint is not a file',
        {
          path: entryPath,
        },
      );
    }

    return success('PROD_BACKEND_BUILD_OK', 'Backend production build exists', {
      path: entryPath,
    });
  } catch (error) {
    return failure('PROD_BACKEND_BUILD_MISSING', 'Backend production build is missing', {
      error: formatError(error),
      path: entryPath,
    });
  }
}

export async function checkFrontendBuild({ projectRoot }) {
  const distPath = resolve(projectRoot, 'frontend/dist');
  const indexPath = resolve(distPath, 'index.html');
  const assetsPath = resolve(distPath, 'assets');

  try {
    const [distStat, indexStat, assetsStat] = await Promise.all([
      stat(distPath),
      stat(indexPath),
      stat(assetsPath),
    ]);

    if (!distStat.isDirectory()) {
      return frontendBuildFailure('frontend/dist is not a directory', {
        path: distPath,
      });
    }

    if (!indexStat.isFile()) {
      return frontendBuildFailure('frontend/dist/index.html is not a file', {
        path: indexPath,
      });
    }

    if (!assetsStat.isDirectory()) {
      return frontendBuildFailure('frontend/dist/assets is not a directory', {
        path: assetsPath,
      });
    }

    const assets = await readdir(assetsPath);

    if (assets.length === 0) {
      return frontendBuildFailure('frontend/dist/assets is empty', {
        path: assetsPath,
      });
    }

    return success('PROD_FRONTEND_BUILD_OK', 'Frontend production build exists', {
      assets: assets.length,
      path: distPath,
    });
  } catch (error) {
    return frontendBuildFailure('Frontend production build is missing', {
      error: formatError(error),
      path: distPath,
    });
  }
}

function frontendBuildFailure(message, details) {
  return failure('PROD_FRONTEND_BUILD_MISSING', message, details);
}
