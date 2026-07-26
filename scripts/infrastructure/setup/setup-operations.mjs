import { checkRequiredApplicationData } from '../application-data/required-data.mjs';
import { checkMinioBucket, ensureMinioBucket } from '../minio/bucket.mjs';
import { createS3Client } from '../minio/client.mjs';
import { ensureMinioAvailable } from '../minio/ensure-minio-available.mjs';
import { checkMinioObjectRoundtrip } from '../minio/object-roundtrip.mjs';
import { checkMinioReadiness } from '../minio/readiness.mjs';
import { checkPostgresConnection } from '../postgres/connection.mjs';
import { terminatePgClient } from '../postgres/pg-client-terminator.mjs';
import { generatePrismaClient } from '../prisma/generate.mjs';
import { deployPrismaMigrations } from '../prisma/migrations.mjs';
import { seedDatabase } from '../prisma/seed.mjs';
import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export function createDefaultSetupOperations() {
  return {
    checkMinioReadiness,
    ensureMinioAvailable,
    checkPostgresConnection: ({ config, PgClient, ...options }) =>
      checkPostgresConnection({
        config,
        PgClient,
        terminateClient: terminatePgClient,
        ...options,
      }),
    checkRequiredApplicationData,
    deployPrismaMigrations,
    ensureStorageBucket,
    generatePrismaClient,
    seedDatabase,
    verifySetupInfrastructure,
  };
}

async function ensureStorageBucket({
  config,
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
}) {
  const client = createS3Client({ config, S3Client });
  let result;

  try {
    result = await ensureMinioBucket({
      bucket: config.minio.bucket,
      client,
      CreateBucketCommand,
      HeadBucketCommand,
    });
  } catch (error) {
    destroyClient(client);
    throw error;
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}

async function verifySetupInfrastructure({
  checkMinioReadiness: checkMinioReadinessOperation = checkMinioReadiness,
  checkPostgresConnection: checkPostgresConnectionOperation = ({
    config,
    PgClient,
    ...options
  }) =>
    checkPostgresConnection({
      config,
      PgClient,
      terminateClient: terminatePgClient,
      ...options,
    }),
  config,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PgClient,
  PutObjectCommand,
  S3Client,
}) {
  const postgres = await checkPostgresConnectionOperation({
    config,
    PgClient,
  });

  if (!postgres.ok) {
    return finalCheckFailure(postgres);
  }

  const readiness = await checkMinioReadinessOperation({ config });

  if (!readiness.ok) {
    return finalCheckFailure(readiness);
  }

  const client = createS3Client({ config, S3Client });
  let result;

  try {
    const bucket = await checkMinioBucket({
      bucket: config.minio.bucket,
      client,
      HeadBucketCommand,
    });

    if (!bucket.ok) {
      result = finalCheckFailure(bucket);
    } else {
      const objectAccess = await checkMinioObjectRoundtrip(client, {
        bucket: config.minio.bucket,
        DeleteObjectCommand,
        GetObjectCommand,
        PutObjectCommand,
      });

      result = objectAccess.ok
        ? success('SETUP_FINAL_CHECK_OK', 'Setup infrastructure is ready')
        : finalCheckFailure(objectAccess);
    }
  } catch (error) {
    destroyClient(client);
    throw error;
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}

function destroyClient(client) {
  try {
    client.destroy();

    return { ok: true };
  } catch (error) {
    return {
      error: formatError(error),
      ok: false,
    };
  }
}

function mergeClientCleanupResult(operationResult, cleanupResult) {
  if (cleanupResult.ok) {
    return operationResult;
  }

  if (!operationResult.ok) {
    return failure(operationResult.code, operationResult.message, {
      ...(operationResult.details ?? {}),
      cleanupError: cleanupResult.error,
    });
  }

  return failure(
    'MINIO_CLIENT_CLEANUP_FAILED',
    'Unable to close MinIO client',
    {
      cleanupError: cleanupResult.error,
      operationResult,
    },
  );
}

function finalCheckFailure(result) {
  return failure('SETUP_FINAL_CHECK_FAILED', result.message, {
    causeCode: result.code,
  });
}