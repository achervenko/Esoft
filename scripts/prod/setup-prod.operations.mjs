import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { npmCommandName } from '../infrastructure/commands/npm-command.mjs';
import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { ensureMinioBucket } from '../infrastructure/minio/bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import { checkPostgresConnection } from '../infrastructure/postgres/connection.mjs';
import { terminatePgClient } from '../infrastructure/postgres/pg-client-terminator.mjs';
import { generatePrismaClient } from '../infrastructure/prisma/generate.mjs';
import {
  checkPrismaMigrationStatus,
  deployPrismaMigrations,
} from '../infrastructure/prisma/migrations.mjs';
import { seedDatabase } from '../infrastructure/prisma/seed.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import { loadProductionConfig } from './setup-prod.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultProjectRoot = resolve(__dirname, '../..');

export function createDefaultProductionSetupOperations() {
  return {
    loadProductionConfig,
    checkPostgresConnection: ({ config, PgClient }) =>
      checkPostgresConnection({
        config,
        PgClient,
        terminateClient: terminatePgClient,
      }),
    generatePrismaClient,
    checkPrismaMigrationStatus,
    deployPrismaMigrations,
    seedDatabase,
    ensureStorageBucket,
  };
}

export function createDefaultProductionSetupContext(options = {}) {
  return {
    npm: options.npm ?? npmCommandName(),
    projectRoot: options.projectRoot ?? defaultProjectRoot,
    runCommand: options.runCommand ?? runCommand,
    ...options.runtimeDependencies,
  };
}

export function normalizePreDeployMigrationStatus(result) {
  if (result.ok) {
    return result;
  }

  if (result.code === 'PRISMA_MIGRATIONS_PENDING') {
    return success(
      'PRISMA_MIGRATIONS_PENDING',
      'Prisma migrations are pending and will be deployed',
      result.details,
    );
  }

  return result;
}

export function loadRuntimeDependencies(projectRoot = defaultProjectRoot) {
  const backendRequire = createRequire(
    resolve(projectRoot, 'backend/package.json'),
  );
  const { Client: PgClient } = backendRequire('pg');
  const {
    CreateBucketCommand,
    HeadBucketCommand,
    S3Client,
  } = backendRequire('@aws-sdk/client-s3');

  return {
    CreateBucketCommand,
    HeadBucketCommand,
    PgClient,
    S3Client,
  };
}

async function ensureStorageBucket({
  config,
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
}) {
  const client = createS3Client({ config, S3Client });

  try {
    return await ensureMinioBucket({
      bucket: config.minio.bucket,
      client,
      CreateBucketCommand,
      HeadBucketCommand,
    });
  } catch (error) {
    return failure('MINIO_BUCKET_CHECK_FAILED', 'Unable to check MinIO bucket', {
      error: formatError(error),
    });
  } finally {
    client.destroy();
  }
}
