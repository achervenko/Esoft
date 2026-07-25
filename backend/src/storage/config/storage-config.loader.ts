import { loadRootConfig } from '../../config/root-environment';
import type { StorageConfig } from './storage-config.type';

export function loadStorageConfig(): StorageConfig {
  const config = loadRootConfig();

  return {
    accessKey: config.minio.accessKey,
    bucket: config.minio.bucket,
    endpoint: config.minio.endpoint,
    forcePathStyle: true,
    region: config.minio.region,
    secretKey: config.minio.secretKey,
  };
}
