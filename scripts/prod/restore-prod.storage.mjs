import { createReadStream } from 'node:fs';

import { checkMinioBucket } from '../infrastructure/minio/bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import {
  destroyClient,
  mergeClientCleanupResult,
} from '../infrastructure/minio/client-cleanup.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import {
  listObjectKeys,
  summarizeBucket,
} from './restore-prod.storage-bucket.mjs';
import { collectBackupObjects } from './backup-storage-files.mjs';

export async function checkStorageBucket({
  config,
  HeadBucketCommand,
  S3Client,
}) {
  const client = createS3Client({ config, S3Client });
  let result;

  try {
    result = await checkMinioBucket({
      bucket: config.minio.bucket,
      client,
      HeadBucketCommand,
    });

    if (!result.ok) {
      result = failure('MINIO_BUCKET_UNAVAILABLE', result.message, result.details);
    } else {
      result = success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available', {
        bucket: config.minio.bucket,
      });
    }
  } catch (error) {
    result = failure('MINIO_BUCKET_UNAVAILABLE', 'Unable to check MinIO bucket', {
      bucket: config.minio.bucket,
      error: formatError(error),
    });
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}

export async function replaceStorageBucket({
  config,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  storagePath,
}) {
  const client = createS3Client({ config, S3Client });
  let deletedObjectCount = 0;
  let result;
  let uploadedObjectCount = 0;
  let uploadedTotalBytes = 0;

  try {
    const backupObjects = await collectBackupObjects(storagePath);

    if (!backupObjects.ok) {
      result = backupObjects;
    } else {
      const existingObjectKeys = await listObjectKeys({
        bucket: config.minio.bucket,
        client,
        ListObjectsV2Command,
      });

      if (!existingObjectKeys.ok) {
        result = existingObjectKeys;
      } else {
        for (const objectKey of existingObjectKeys.details.objectKeys) {
          await client.send(
            new DeleteObjectCommand({
              Bucket: config.minio.bucket,
              Key: objectKey,
            }),
          );
          deletedObjectCount += 1;
        }

        for (const object of backupObjects.details.objects) {
          await client.send(
            new PutObjectCommand({
              Body: createReadStream(object.path),
              Bucket: config.minio.bucket,
              ContentLength: object.size,
              Key: object.key,
            }),
          );
          uploadedObjectCount += 1;
          uploadedTotalBytes += object.size;
        }
      }
    }

    result ??= success('MINIO_RESTORE_OK', 'MinIO bucket restored', {
      bucket: config.minio.bucket,
      deletedObjectCount,
      objectCount: uploadedObjectCount,
      totalBytes: uploadedTotalBytes,
    });
  } catch (error) {
    result = failure('MINIO_RESTORE_FAILED', 'MinIO bucket restore failed', {
      bucket: config.minio.bucket,
      deletedObjectCount,
      error: formatError(error),
      objectCount: uploadedObjectCount,
      totalBytes: uploadedTotalBytes,
    });
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}

export async function verifyRestoredStorage({
  config,
  expectedObjectCount,
  expectedTotalBytes,
  ListObjectsV2Command,
  S3Client,
}) {
  const client = createS3Client({ config, S3Client });
  let result;

  try {
    const summary = await summarizeBucket({
      bucket: config.minio.bucket,
      client,
      ListObjectsV2Command,
    });

    if (!summary.ok) {
      result = summary;
    } else if (
      summary.details.objectCount !== expectedObjectCount ||
      summary.details.totalBytes !== expectedTotalBytes
    ) {
      result = failure('MINIO_RESTORE_VERIFY_FAILED', 'MinIO restore verification failed', {
        actualObjectCount: summary.details.objectCount,
        actualTotalBytes: summary.details.totalBytes,
        expectedObjectCount,
        expectedTotalBytes,
      });
    } else {
      result = success('RESTORE_VERIFIED', 'Restore verified', {
        bucket: config.minio.bucket,
        objectCount: summary.details.objectCount,
        totalBytes: summary.details.totalBytes,
      });
    }
  } catch (error) {
    result = failure('MINIO_RESTORE_VERIFY_FAILED', 'MinIO restore verification failed', {
      bucket: config.minio.bucket,
      error: formatError(error),
      expectedObjectCount,
      expectedTotalBytes,
    });
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}
