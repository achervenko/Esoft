import assert from 'node:assert/strict';
import test from 'node:test';

import { checkMinioObjectRoundtrip } from '../../../../scripts/infrastructure/minio/object-roundtrip.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

class PutObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class GetObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class DeleteObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

test('checkMinioObjectRoundtrip writes, reads and deletes an object', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command);

        if (command instanceof GetObjectCommand) {
          return {
            Body: {
              transformToString: async () => 'esoft system check 123',
            },
          };
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_OK');
  assert.equal(result.details.key, 'system-check/123-fixed-test.txt');
  assert.equal(calls.length, 3);
  assert.equal(calls[0] instanceof PutObjectCommand, true);
  assert.deepEqual(calls[0].input, {
    Body: 'esoft system check 123',
    Bucket: 'esoft',
    Key: 'system-check/123-fixed-test.txt',
  });
  assert.equal(calls[1] instanceof GetObjectCommand, true);
  assert.deepEqual(calls[1].input, {
    Bucket: 'esoft',
    Key: 'system-check/123-fixed-test.txt',
  });
  assert.equal(calls[2] instanceof DeleteObjectCommand, true);
  assert.deepEqual(calls[2].input, {
    Bucket: 'esoft',
    Key: 'system-check/123-fixed-test.txt',
  });
});

test('checkMinioObjectRoundtrip does not delete when upload fails', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command.constructor.name);
        throw new Error('upload failed');
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'put');
  assert.deepEqual(calls, ['PutObjectCommand']);
});

test('checkMinioObjectRoundtrip cleans up after read failure', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command.constructor.name);

        if (command instanceof GetObjectCommand) {
          throw new Error('read failed');
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'get');
  assert.deepEqual(calls, [
    'PutObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
  ]);
});

test('checkMinioObjectRoundtrip handles a missing response body and cleans up', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command.constructor.name);

        if (command instanceof GetObjectCommand) {
          return {};
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'read');
  assert.deepEqual(calls, [
    'PutObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
  ]);
});

test('checkMinioObjectRoundtrip cleans up after response body read failure', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command.constructor.name);

        if (command instanceof GetObjectCommand) {
          return {
            Body: {
              transformToString: async () => {
                throw new Error('body read failed');
              },
            },
          };
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'read');
  assert.deepEqual(calls, [
    'PutObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
  ]);
});

test('checkMinioObjectRoundtrip reports content mismatch and deletes the object', async () => {
  const calls = [];
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        calls.push(command.constructor.name);

        if (command instanceof GetObjectCommand) {
          return {
            Body: {
              transformToString: async () => 'unexpected content',
            },
          };
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'verify');
  assert.deepEqual(calls, [
    'PutObjectCommand',
    'GetObjectCommand',
    'DeleteObjectCommand',
  ]);
});

test('checkMinioObjectRoundtrip reports delete failure after successful verification', async () => {
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        if (command instanceof GetObjectCommand) {
          return {
            Body: {
              transformToString: async () => 'esoft system check 123',
            },
          };
        }

        if (command instanceof DeleteObjectCommand) {
          throw new Error('delete failed');
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.equal(result.details.stage, 'delete');
  assert.equal(result.details.error, 'delete failed');
});

test('checkMinioObjectRoundtrip preserves primary and cleanup failures', async () => {
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        if (command instanceof GetObjectCommand) {
          throw new Error('read failed');
        }

        if (command instanceof DeleteObjectCommand) {
          throw new Error('delete failed');
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assert.deepEqual(result.details, {
    bucket: 'esoft',
    cleanupError: 'delete failed',
    error: 'read failed',
    key: 'system-check/123-fixed-test.txt',
    stage: 'get',
  });
});

test('checkMinioObjectRoundtrip does not leak secrets from primary failure', async () => {
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        if (command instanceof GetObjectCommand) {
          throw new Error(`read failed ${SECRET_MARKERS[0]}`);
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assertNoSecretLeak(result);
});

test('checkMinioObjectRoundtrip does not leak secrets from cleanup failure', async () => {
  const result = await checkMinioObjectRoundtrip(
    {
      send: async (command) => {
        if (command instanceof GetObjectCommand) {
          throw new Error('read failed');
        }

        if (command instanceof DeleteObjectCommand) {
          throw new Error(`delete failed ${SECRET_MARKERS[0]}`);
        }

        return {};
      },
    },
    {
      bucket: 'esoft',
      DeleteObjectCommand,
      GetObjectCommand,
      now: () => 123,
      PutObjectCommand,
      randomId: () => 'fixed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_OBJECT_ROUNDTRIP_FAILED');
  assertNoSecretLeak(result);
});
