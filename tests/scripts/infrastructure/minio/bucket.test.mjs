import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkMinioBucket,
  ensureMinioBucket,
} from '../../../../scripts/infrastructure/minio/bucket.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

class HeadBucketCommand {
  constructor(input) {
    this.input = input;
  }
}

class CreateBucketCommand {
  constructor(input) {
    this.input = input;
  }
}

test('checkMinioBucket returns available when head succeeds', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        assert.equal(command instanceof HeadBucketCommand, true);
        assert.deepEqual(command.input, { Bucket: 'esoft' });
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_BUCKET_AVAILABLE');
});

test('checkMinioBucket classifies missing bucket', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async () => {
        const error = new Error('missing');
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_MISSING');
});

test('checkMinioBucket reports access denied separately from missing bucket', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async () => {
        const error = new Error('access denied');
        error.$metadata = { httpStatusCode: 403 };
        throw error;
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_ACCESS_DENIED');
  assert.deepEqual(result.details, {
    bucket: 'esoft',
    status: 403,
  });
});

test('checkMinioBucket reports unexpected head failure', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async () => {
        const error = new Error('server failed');
        error.$metadata = { httpStatusCode: 500 };
        throw error;
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CHECK_FAILED');
  assert.equal(result.details.error, 'server failed');
  assert.equal(result.details.status, 500);
});

test('bucket operations do not leak secrets', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async () => {
        throw new Error(
          `request failed MINIO_SECRET_KEY=actual-secret password=hunter2 http://user:pass@127.0.0.1:9000 authorization: bearer-token ${SECRET_MARKERS[0]}`,
        );
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.error.includes('actual-secret'), false);
  assert.equal(result.details.error.includes('hunter2'), false);
  assert.equal(result.details.error.includes('pass@'), false);
  assert.equal(result.details.error.includes('bearer-token'), false);
  assertNoSecretLeak(result);
});

test('checkMinioBucket handles unformattable errors', async () => {
  const result = await checkMinioBucket({
    bucket: 'esoft',
    client: {
      send: async () => {
        throw {
          toString() {
            throw new Error('string conversion failed');
          },
        };
      },
    },
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CHECK_FAILED');
  assert.equal(result.details.error, '[unformattable error]');
});

test('ensureMinioBucket does not create an existing bucket', async () => {
  const calls = [];

  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        calls.push(command);
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_BUCKET_AVAILABLE');
  assert.equal(calls.length, 1);
  assert.equal(calls[0] instanceof HeadBucketCommand, true);
  assert.deepEqual(calls[0].input, { Bucket: 'esoft' });
});

test('ensureMinioBucket does not create after an unexpected bucket check failure', async () => {
  const calls = [];

  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        calls.push(command);

        const error = new Error('server failed');
        error.$metadata = { httpStatusCode: 500 };
        throw error;
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CHECK_FAILED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0] instanceof HeadBucketCommand, true);
  assert.deepEqual(calls[0].input, { Bucket: 'esoft' });
});

test('ensureMinioBucket creates a missing bucket', async () => {
  const calls = [];
  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        calls.push(command);

        if (command instanceof HeadBucketCommand) {
          const error = new Error('missing');
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_BUCKET_CREATED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0] instanceof HeadBucketCommand, true);
  assert.deepEqual(calls[0].input, { Bucket: 'esoft' });
  assert.equal(calls[1] instanceof CreateBucketCommand, true);
  assert.deepEqual(calls[1].input, { Bucket: 'esoft' });
});

test('ensureMinioBucket reports bucket creation failure', async () => {
  const calls = [];

  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        calls.push(command);

        if (command instanceof HeadBucketCommand) {
          const error = new Error('missing');
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }

        throw new Error('creation failed');
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CREATE_FAILED');
  assert.equal(result.details.error, 'creation failed');
  assert.equal(calls.length, 2);
});

test('ensureMinioBucket does not leak secrets from creation failure', async () => {
  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        if (command instanceof HeadBucketCommand) {
          const error = new Error('missing');
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }

        throw new Error(
          `creation failed MINIO_SECRET_KEY=actual-secret password=hunter2 http://user:pass@127.0.0.1:9000 authorization: bearer-token ${SECRET_MARKERS[0]}`,
        );
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CREATE_FAILED');
  assert.equal(result.details.error.includes('actual-secret'), false);
  assert.equal(result.details.error.includes('hunter2'), false);
  assert.equal(result.details.error.includes('pass@'), false);
  assert.equal(result.details.error.includes('bearer-token'), false);
  assertNoSecretLeak(result);
});

test('ensureMinioBucket handles bucket creation race', async () => {
  let headCalls = 0;
  const calls = [];
  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        calls.push(command);

        if (command instanceof HeadBucketCommand) {
          headCalls += 1;

          if (headCalls === 1) {
            const error = new Error('missing');
            error.$metadata = { httpStatusCode: 404 };
            throw error;
          }
        }

        if (command instanceof CreateBucketCommand) {
          const error = new Error('already owned');
          error.name = 'BucketAlreadyOwnedByYou';
          throw error;
        }
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_BUCKET_AVAILABLE');
  assert.equal(headCalls, 2);
  assert.deepEqual(
    calls.map((command) => command.constructor.name),
    ['HeadBucketCommand', 'CreateBucketCommand', 'HeadBucketCommand'],
  );
  assert.deepEqual(
    calls.map((command) => command.input),
    [{ Bucket: 'esoft' }, { Bucket: 'esoft' }, { Bucket: 'esoft' }],
  );
});

test('ensureMinioBucket reports failure when bucket remains unavailable after creation race', async () => {
  let headCalls = 0;

  const result = await ensureMinioBucket({
    bucket: 'esoft',
    client: {
      send: async (command) => {
        if (command instanceof HeadBucketCommand) {
          headCalls += 1;

          const error = new Error(
            headCalls === 1 ? 'missing' : 'still unavailable',
          );
          error.$metadata = {
            httpStatusCode: headCalls === 1 ? 404 : 503,
          };
          throw error;
        }

        const error = new Error('already owned');
        error.name = 'BucketAlreadyOwnedByYou';
        throw error;
      },
    },
    CreateBucketCommand,
    HeadBucketCommand,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_BUCKET_CHECK_FAILED');
  assert.equal(headCalls, 2);
});
