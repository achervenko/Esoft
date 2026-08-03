import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function listObjectKeys({ bucket, client, ListObjectsV2Command }) {
  const objectKeys = [];
  let continuationToken;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (typeof object.Key === 'string' && object.Key.length > 0) {
        objectKeys.push(object.Key);
      }
    }

    if (
      page.IsTruncated &&
      !isValidContinuationToken(page.NextContinuationToken)
    ) {
      return failure(
        'MINIO_RESTORE_FAILED',
        'MinIO object listing is truncated without a continuation token',
        {
          bucket,
          objectCount: objectKeys.length,
        },
      );
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return success('MINIO_OBJECTS_LISTED', 'MinIO objects listed', {
    objectKeys,
  });
}

export async function summarizeBucket({ bucket, client, ListObjectsV2Command }) {
  let continuationToken;
  let objectCount = 0;
  let totalBytes = 0;

  try {
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of page.Contents ?? []) {
        if (typeof object.Key !== 'string' || object.Key.length === 0) {
          continue;
        }

        if (!Number.isInteger(object.Size) || object.Size < 0) {
          return failure(
            'MINIO_RESTORE_VERIFY_FAILED',
            'MinIO object has an invalid size',
            {
              bucket,
              objectCount,
              objectKey: object.Key,
              totalBytes,
            },
          );
        }

        objectCount += 1;
        totalBytes += object.Size;
      }

      if (
        page.IsTruncated &&
        !isValidContinuationToken(page.NextContinuationToken)
      ) {
        return failure(
          'MINIO_RESTORE_VERIFY_FAILED',
          'MinIO object listing is truncated without a continuation token',
          {
            bucket,
            objectCount,
            totalBytes,
          },
        );
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return success('MINIO_RESTORE_SUMMARY_OK', 'MinIO bucket summarized', {
      objectCount,
      totalBytes,
    });
  } catch (error) {
    return failure(
      'MINIO_RESTORE_VERIFY_FAILED',
      'Unable to verify MinIO restore',
      {
        bucket,
        error: formatError(error),
        objectCount,
        totalBytes,
      },
    );
  }
}

function isValidContinuationToken(value) {
  return typeof value === 'string' && value.length > 0;
}
