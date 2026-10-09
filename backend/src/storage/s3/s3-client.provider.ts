import { S3Client } from '@aws-sdk/client-s3';
import type { OnApplicationShutdown, Provider } from '@nestjs/common';
import type { StorageConfig } from '../config/storage-config.type';
import { S3_CLIENT, STORAGE_CONFIG } from '../storage.tokens';

export class StorageS3Client extends S3Client implements OnApplicationShutdown {
  onApplicationShutdown() {
    this.destroy();
  }
}

export const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [STORAGE_CONFIG],
  useFactory: (config: StorageConfig) =>
    new StorageS3Client({
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
    }),
};
