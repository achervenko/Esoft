import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkMinioBucket({ bucket, client, HeadBucketCommand }) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available', {
      bucket,
    });
  } catch (error) {
    return classifyBucketError(error, bucket);
  }
}

export async function ensureMinioBucket({
  bucket,
  client,
  CreateBucketCommand,
  HeadBucketCommand,
}) {
  const existing = await checkMinioBucket({ bucket, client, HeadBucketCommand });

  if (existing.ok) {
    return existing;
  }

  if (existing.code !== 'MINIO_BUCKET_MISSING') {
    return existing;
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    return success('MINIO_BUCKET_CREATED', 'MinIO bucket was created', {
      bucket,
    });
  } catch (error) {
    if (isBucketAlreadyAvailableError(error)) {
      return checkMinioBucket({
        bucket,
        client,
        HeadBucketCommand,
      });
    }

    return failure('MINIO_BUCKET_CREATE_FAILED', 'Unable to create MinIO bucket', {
      bucket,
      error: formatError(error),
    });
  }
}

function classifyBucketError(error, bucket) {
  const status = error?.$metadata?.httpStatusCode;
  const name = error?.name;

  if (status === 404 || name === 'NotFound' || name === 'NoSuchBucket') {
    return failure('MINIO_BUCKET_MISSING', 'MinIO bucket is missing', {
      bucket,
      status,
    });
  }

  if (status === 401) {
    return failure(
      'MINIO_AUTHENTICATION_FAILED',
      'MinIO authentication failed',
      {
        bucket,
        status,
      },
    );
  }

  if (status === 403 || name === 'AccessDenied') {
    return failure('MINIO_ACCESS_DENIED', 'Access to the MinIO bucket was denied', {
      bucket,
      status,
    });
  }

  if (status === 0 || isConnectivityError(error)) {
    return failure('MINIO_API_UNAVAILABLE', 'MinIO API is unavailable', {
      bucket,
      error: formatError(error),
      status,
    });
  }

  return failure('MINIO_BUCKET_CHECK_FAILED', 'Unable to check MinIO bucket', {
    bucket,
    error: formatError(error),
    status,
  });
}

function isBucketAlreadyAvailableError(error) {
  return (
    error?.name === 'BucketAlreadyOwnedByYou' ||
    error?.name === 'BucketAlreadyExists'
  );
}

function isConnectivityError(error) {
  return (
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
    ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(
      error?.code,
    )
  );
}
