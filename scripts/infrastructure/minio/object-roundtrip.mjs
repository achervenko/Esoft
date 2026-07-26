import { randomUUID } from 'node:crypto';

import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkMinioObjectRoundtrip(
  client,
  {
    bucket,
    DeleteObjectCommand,
    GetObjectCommand,
    keyPrefix = 'system-check',
    now = () => Date.now(),
    PutObjectCommand,
    randomId = () => randomUUID(),
  },
) {
  const timestamp = now();
  const key = `${keyPrefix}/${timestamp}-${randomId()}-test.txt`;
  const body = `esoft system check ${timestamp}`;
  let objectCreated = false;
  let objectDeleted = false;
  let stage = 'put';

  try {
    await client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: bucket,
        Key: key,
      }),
    );
    objectCreated = true;

    stage = 'get';
    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    stage = 'read';
    const received = await object.Body.transformToString();

    if (received !== body) {
      stage = 'verify';
      const details = { bucket, key, stage };

      await deleteCreatedObject(client, {
        DeleteObjectCommand,
        details,
        key,
        bucket,
      });

      return failure(
        'MINIO_OBJECT_ROUNDTRIP_FAILED',
        'MinIO test object content mismatch',
        details,
      );
    }

    stage = 'delete';
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    objectDeleted = true;

    return success(
      'MINIO_OBJECT_ROUNDTRIP_OK',
      'MinIO test object write/read/delete succeeded',
      { bucket, key },
    );
  } catch (error) {
    const result = failure(
      'MINIO_OBJECT_ROUNDTRIP_FAILED',
      'MinIO test object write/read/delete failed',
      {
        bucket,
        error: formatError(error),
        key,
        stage,
      },
    );

    if (objectCreated && !objectDeleted && stage !== 'delete') {
      await deleteCreatedObject(client, {
        DeleteObjectCommand,
        details: result.details,
        key,
        bucket,
      });
    }

    return result;
  }
}

async function deleteCreatedObject(
  client,
  {
    bucket,
    DeleteObjectCommand,
    details,
    key,
  },
) {
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (error) {
    details.cleanupError = formatError(error);
  }
}
