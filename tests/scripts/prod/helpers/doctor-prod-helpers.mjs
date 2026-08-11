import { success } from '../../../../scripts/infrastructure/result.mjs';

export class HeadBucketCommand {
  constructor(input) {
    this.input = input;
  }
}

export function createOperations(overrides = {}) {
  const calls = overrides.calls ?? [];
  const operation = (name, defaultResult) => async () => {
    calls.push(name);

    if (typeof overrides[name] === 'function') {
      return overrides[name]();
    }

    return defaultResult;
  };
  const operations = {
    loadProductionConfig: async () => {
      calls.push('loadProductionConfig');

      if (typeof overrides.loadProductionConfig === 'function') {
        return overrides.loadProductionConfig();
      }

      return createLoadedConfig();
    },
    checkPostgresConnection: operation(
      'checkPostgresConnection',
      success('POSTGRES_CONNECTION_OK', 'PostgreSQL connection is available'),
    ),
    checkPrismaMigrationStatus: operation(
      'checkPrismaMigrationStatus',
      success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
    ),
    checkStorageBucket: operation(
      'checkStorageBucket',
      success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available'),
    ),
    checkBackendBuild: operation(
      'checkBackendBuild',
      success('PROD_BACKEND_BUILD_OK', 'Backend production build exists'),
    ),
    checkFrontendBuild: operation(
      'checkFrontendBuild',
      success('PROD_FRONTEND_BUILD_OK', 'Frontend production build exists'),
    ),
  };

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete operations[name];
    }
  }

  return operations;
}

export function createTestRuntime({
  output = createOutput(),
  projectRoot = 'C:/project',
} = {}) {
  return {
    npm: 'npm',
    output,
    projectRoot,
    runCommand: async () => {
      throw new Error('runCommand should be mocked by operations');
    },
    runtimeDependencies: {
      HeadBucketCommand,
      PgClient: class PgClient {},
      S3Client: class S3Client {},
    },
  };
}

export function createOutput() {
  const lines = [];

  return {
    lines,
    log(value = '') {
      lines.push(String(value));
    },
  };
}

export function createConfig() {
  return {
    database: {
      url: 'postgresql://user:[redacted]@localhost:5432/esoft',
    },
    minio: {
      accessKey: '[redacted]',
      bucket: 'esoft',
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      secretKey: '[redacted]',
    },
    nodeEnv: 'production',
  };
}

export function createS3ClientClass({
  destroyError = null,
  headBucketError = null,
} = {}) {
  return class FakeS3Client {
    destroy() {
      if (destroyError) {
        throw destroyError;
      }
    }

    async send() {
      if (headBucketError) {
        throw headBucketError;
      }

      return {};
    }
  };
}

export function createLoadedConfig({ projectRoot = 'C:/project' } = {}) {
  return {
    config: createConfig(),
    env: {
      DATABASE_URL: 'postgresql://user:[redacted]@localhost:5432/esoft',
    },
    projectRoot,
    result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
  };
}
