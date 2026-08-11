import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { checkMinioBucket } from '../infrastructure/minio/bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import {
  destroyClient,
  mergeClientCleanupResult,
} from '../infrastructure/minio/client-cleanup.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import {
  createObjectPathTracker,
  resolveObjectBackupPath,
} from './backup-prod.storage-path.mjs';

export { resolveObjectBackupPath } from './backup-prod.storage-path.mjs';

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

export async function backupStorageBucket({
  config,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  storagePath,
}) {
  const client = createS3Client({ config, S3Client });
  const pathTracker = createObjectPathTracker();
  let continuationToken;
  let objectCount = 0;
  let result;
  let totalBytes = 0;

  try {
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: config.minio.bucket,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of page.Contents ?? []) {
        const objectKey = object.Key;

        if (typeof objectKey !== 'string' || objectKey.length === 0) {
          continue;
        }

        const filePathResult = resolveObjectBackupPath(storagePath, objectKey);

        if (!filePathResult.ok) {
          result = filePathResult;
          break;
        }

        const registrationResult = pathTracker.register({
          objectKey,
          segments: filePathResult.details.segments,
        });

        if (!registrationResult.ok) {
          result = registrationResult;
          break;
        }

        const objectResponse = await client.send(
          new GetObjectCommand({
            Bucket: config.minio.bucket,
            Key: objectKey,
          }),
        );

        await writeObjectBodyToFile(
          objectResponse.Body,
          filePathResult.details.path,
        );
        objectCount += 1;
        totalBytes += Number.isFinite(object.Size) ? object.Size : 0;
      }

      if (
        result ||
        (page.IsTruncated &&
          !isValidContinuationToken(page.NextContinuationToken))
      ) {
        if (!result) {
          result = failure(
            'MINIO_BACKUP_FAILED',
            'MinIO object listing is truncated without a continuation token',
            {
              bucket: config.minio.bucket,
              objectCount,
              totalBytes,
            },
          );
        }
        break;
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    result ??= success('MINIO_BACKUP_OK', 'MinIO bucket backup completed', {
      bucket: config.minio.bucket,
      objectCount,
      totalBytes,
    });
  } catch (error) {
    result = failure('MINIO_BACKUP_FAILED', 'MinIO bucket backup failed', {
      bucket: config.minio.bucket,
      error: formatError(error),
      objectCount,
      totalBytes,
    });
  }

  return mergeClientCleanupResult(result, destroyClient(client));
}

async function writeObjectBodyToFile(body, filePath) {
  if (!body) {
    throw new Error('MinIO object body is empty');
  }

  await mkdir(dirname(filePath), { recursive: true });
  await pipeline(toReadableStream(body), createWriteStream(filePath));
}

function toReadableStream(body) {
  if (body instanceof Readable) {
    return body;
  }

  if (typeof body.pipe === 'function') {
    return body;
  }

  if (typeof body.transformToWebStream === 'function') {
    return Readable.fromWeb(body.transformToWebStream());
  }

  throw new TypeError('MinIO object body is not a readable stream');
}

function isValidContinuationToken(value) {
  return typeof value === 'string' && value.length > 0;
}
