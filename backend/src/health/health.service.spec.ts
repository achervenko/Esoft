import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ok when PostgreSQL and MinIO bucket are available', async () => {
    const service = createService();

    await expect(service.check()).resolves.toEqual({
      dependencies: {
        minio: 'ok',
        minioBucket: 'ok',
        postgres: 'ok',
      },
      status: 'ok',
    });
  });

  it('reports PostgreSQL error without hiding MinIO status', async () => {
    const service = createService({
      postgresError: new Error('database unavailable'),
    });

    await expect(service.check()).resolves.toEqual({
      dependencies: {
        minio: 'ok',
        minioBucket: 'ok',
        postgres: 'error',
      },
      status: 'error',
    });
  });

  it('reports MinIO error for unexpected bucket check failures', async () => {
    const service = createService({
      bucketError: new Error('connect ECONNREFUSED 127.0.0.1:9000'),
    });

    await expect(service.check()).resolves.toEqual({
      dependencies: {
        minio: 'error',
        minioBucket: 'error',
        postgres: 'ok',
      },
      status: 'error',
    });
  });

  it('reports bucket error separately when MinIO responds with missing bucket', async () => {
    const error = new Error('missing bucket') as Error & {
      $metadata: { httpStatusCode: number };
    };
    error.$metadata = { httpStatusCode: 404 };
    const service = createService({
      bucketError: error,
    });

    await expect(service.check()).resolves.toEqual({
      dependencies: {
        minio: 'ok',
        minioBucket: 'error',
        postgres: 'ok',
      },
      status: 'error',
    });
  });

  it('reports MinIO error when bucket access is forbidden', async () => {
    const error = new Error('forbidden') as Error & {
      $metadata: { httpStatusCode: number };
    };
    error.$metadata = { httpStatusCode: 403 };
    const service = createService({
      bucketError: error,
    });

    await expect(service.check()).resolves.toEqual({
      dependencies: {
        minio: 'error',
        minioBucket: 'error',
        postgres: 'ok',
      },
      status: 'error',
    });
  });

  it('checks MinIO bucket read-only without creating a bucket', async () => {
    const storage = {
      assertBucketAvailable: jest.fn().mockResolvedValue(undefined),
      createBucket: jest.fn(),
    };
    const service = createService({ storage });

    await service.check();

    expect(storage.assertBucketAvailable).toHaveBeenCalledTimes(1);
    expect(storage.createBucket).not.toHaveBeenCalled();
  });

  it('does not expose dependency error messages or secrets in the response', async () => {
    const service = createService({
      bucketError: new Error('MINIO_SECRET_KEY=secret'),
      postgresError: new Error('DATABASE_URL=secret'),
    });

    const response = await service.check();

    expect(JSON.stringify(response)).not.toContain('secret');
    expect(response).toEqual({
      dependencies: {
        minio: 'error',
        minioBucket: 'error',
        postgres: 'error',
      },
      status: 'error',
    });
  });
});

function createService({
  bucketError,
  postgresError,
  storage = {
    assertBucketAvailable: jest.fn().mockImplementation(() => {
      if (bucketError) {
        throw bucketError;
      }

      return undefined;
    }),
  },
}: {
  bucketError?: Error;
  postgresError?: Error;
  storage?: {
    assertBucketAvailable: jest.Mock;
    createBucket?: jest.Mock;
  };
} = {}) {
  const prisma = {
    $queryRaw: jest.fn().mockImplementation(() => {
      if (postgresError) {
        throw postgresError;
      }

      return [{ '?column?': 1 }];
    }),
  };

  return new HealthService(prisma as never, storage as never);
}
