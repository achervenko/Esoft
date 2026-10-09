import { createHash } from 'node:crypto';
import { hasValidBackupChecksums } from './backup-integrity.mjs';
import { listObjectKeys } from './restore-prod.storage-bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import {
  destroyClient,
  mergeClientCleanupResult,
} from '../infrastructure/minio/client-cleanup.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function verifyRestoredStorageContents({
  config,
  manifest,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
}) {
  if (!hasValidBackupChecksums(manifest))
    return failure(
      'MINIO_RESTORE_VERIFY_FAILED',
      'Storage checksum metadata is invalid',
    );
  const client = createS3Client({ config, S3Client });
  let result;
  try {
    const keys = await listObjectKeys({
      bucket: config.minio.bucket,
      client,
      ListObjectsV2Command,
    });
    if (!keys.ok) result = keys;
    else {
      const expected = new Map(
        manifest.storage.objects.map((entry) => [entry.key, entry]),
      );
      if (
        keys.details.objectKeys.length !== expected.size ||
        keys.details.objectKeys.some((key) => !expected.has(key))
      )
        throw new Error('Restored storage keys do not match manifest');
      for (const entry of expected.values()) {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.minio.bucket, Key: entry.key }),
        );
        if (!response.Body || !response.Body[Symbol.asyncIterator])
          throw new Error('Restored object body is not readable');
        const hash = createHash('sha256');
        let bytes = 0;
        for await (const chunk of response.Body) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          hash.update(buffer);
          bytes += buffer.length;
        }
        if (bytes !== entry.sizeBytes || hash.digest('hex') !== entry.sha256)
          throw new Error('Restored object contents do not match manifest');
      }
      result = success(
        'MINIO_RESTORE_CONTENTS_VERIFIED',
        'Restored object keys and SHA-256 match manifest',
      );
    }
  } catch (error) {
    result = failure(
      'MINIO_RESTORE_VERIFY_FAILED',
      'Restored storage checksum verification failed',
      { error: formatError(error) },
    );
  }
  return mergeClientCleanupResult(result, destroyClient(client));
}
