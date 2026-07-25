import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { loadRootConfig } from '../config/root-environment';
import { PrismaService } from '../prisma/prisma.service';

type DependencyStatus = 'ok' | 'error';

type HealthResponse = {
  dependencies: {
    minio: DependencyStatus;
    postgres: DependencyStatus;
  };
  status: DependencyStatus;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const [postgres, minio] = await Promise.all([
      this.checkPostgres(),
      this.checkMinio(),
    ]);

    return {
      dependencies: {
        minio,
        postgres,
      },
      status: postgres === 'ok' && minio === 'ok' ? 'ok' : 'error',
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

  private async checkMinio(): Promise<DependencyStatus> {
    const config = loadRootConfig();
    const client = new S3Client({
      credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
      },
      endpoint: config.minio.endpoint,
      forcePathStyle: true,
      region: config.minio.region,
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
      return 'ok';
    } catch {
      return 'error';
    } finally {
      client.destroy();
    }
  }
}
