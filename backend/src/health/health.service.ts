import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectService } from '../storage/storage-object.service';

type DependencyStatus = 'ok' | 'error';

type HealthResponse = {
  dependencies: {
    minio: DependencyStatus;
    minioBucket: DependencyStatus;
    postgres: DependencyStatus;
  };
  status: DependencyStatus;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageObjects: StorageObjectService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [postgres, storage] = await Promise.all([
      this.checkPostgres(),
      this.checkMinio(),
    ]);

    return {
      dependencies: {
        minio: storage.minio,
        minioBucket: storage.bucket,
        postgres,
      },
      status:
        postgres === 'ok' && storage.minio === 'ok' && storage.bucket === 'ok'
          ? 'ok'
          : 'error',
    };
  }

  private async checkPostgres(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkMinio(): Promise<{
    bucket: DependencyStatus;
    minio: DependencyStatus;
  }> {
    try {
      await this.storageObjects.assertBucketAvailable();
      return {
        bucket: 'ok',
        minio: 'ok',
      };
    } catch (error) {
      if (isBucketMissingError(error)) {
        return {
          bucket: 'error',
          minio: 'ok',
        };
      }

      return {
        bucket: 'error',
        minio: 'error',
      };
    }
  }
}

function isBucketMissingError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const storageError = error as {
    $metadata?: {
      httpStatusCode?: number;
    };
    Code?: string;
    name?: string;
  };
  const code = storageError.name ?? storageError.Code ?? '';

  return (
    ['NoSuchBucket', 'NotFound'].includes(code) ||
    storageError.$metadata?.httpStatusCode === 404
  );
}
