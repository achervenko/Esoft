import assert from 'node:assert/strict';
import test from 'node:test';

import { createS3Client } from '../../../../scripts/infrastructure/minio/client.mjs';

test('createS3Client maps validated MinIO config to SDK options', () => {
  let receivedOptions = null;
  class S3Client {
    constructor(options) {
      receivedOptions = options;
    }
  }

  const client = createS3Client({
    config: {
      minio: {
        accessKey: 'access-key',
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        secretKey: 'secret-key',
      },
    },
    S3Client,
  });

  assert.equal(client instanceof S3Client, true);
  assert.deepEqual(receivedOptions, {
    credentials: {
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    },
    endpoint: 'http://127.0.0.1:9000',
    forcePathStyle: true,
    region: 'us-east-1',
  });
});

test('createS3Client preserves HTTPS endpoint', () => {
  let receivedOptions = null;
  class S3Client {
    constructor(options) {
      receivedOptions = options;
    }
  }

  createS3Client({
    config: {
      minio: {
        accessKey: 'access-key',
        endpoint: 'https://minio.example.com',
        region: 'eu-central-1',
        secretKey: 'secret-key',
      },
    },
    S3Client,
  });

  assert.deepEqual(receivedOptions, {
    credentials: {
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    },
    endpoint: 'https://minio.example.com',
    forcePathStyle: true,
    region: 'eu-central-1',
  });
});

test('createS3Client preserves endpoint path and trailing slash', () => {
  let receivedOptions = null;
  class S3Client {
    constructor(options) {
      receivedOptions = options;
    }
  }

  createS3Client({
    config: {
      minio: {
        accessKey: 'access-key',
        endpoint: 'http://127.0.0.1:9000/storage/',
        region: 'us-east-1',
        secretKey: 'secret-key',
      },
    },
    S3Client,
  });

  assert.equal(receivedOptions.endpoint, 'http://127.0.0.1:9000/storage/');
});

test('createS3Client propagates SDK client construction failure', () => {
  class S3Client {
    constructor() {
      throw new Error('SDK construction failed');
    }
  }

  assert.throws(
    () =>
      createS3Client({
        config: {
          minio: {
            accessKey: 'access-key',
            endpoint: 'http://127.0.0.1:9000',
            region: 'us-east-1',
            secretKey: 'secret-key',
          },
        },
        S3Client,
      }),
    /SDK construction failed/,
  );
});

test('createS3Client constructs the injected S3Client exactly once', () => {
  let constructions = 0;

  class S3Client {
    constructor() {
      constructions += 1;
    }
  }

  const client = createS3Client({
    config: {
      minio: {
        accessKey: 'access-key',
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        secretKey: 'secret-key',
      },
    },
    S3Client,
  });

  assert.equal(constructions, 1);
  assert.equal(client instanceof S3Client, true);
});
