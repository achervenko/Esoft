import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkMinioReadiness,
  waitForMinioReadiness,
} from '../../../../scripts/infrastructure/minio/readiness.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const config = {
  minio: {
    endpoint: 'http://127.0.0.1:9000/',
  },
};

test('checkMinioReadiness returns success only for successful HTTP responses', async () => {
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:9000/minio/health/live');
      return { ok: true, status: 200 };
    },
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_READINESS_OK');
});

test('checkMinioReadiness normalizes endpoint without trailing slash', async () => {
  const result = await checkMinioReadiness({
    config: {
      minio: {
        endpoint: 'http://127.0.0.1:9000',
      },
    },
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:9000/minio/health/live');
      return { ok: true, status: 200 };
    },
  });

  assertOperationResult(result, { ok: true });
});

test('checkMinioReadiness treats 404 as not ready', async () => {
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async () => ({ ok: false, status: 404 }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.status, 404);
});

test('checkMinioReadiness reports missing fetch implementation', async () => {
  const result = await checkMinioReadiness({
    config,
    fetchImpl: null,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.error, 'fetch implementation is unavailable');
});

test('checkMinioReadiness handles fetch rejection', async () => {
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async () => {
      throw new Error('connection refused');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.error, 'connection refused');
});

test('checkMinioReadiness handles fetch rejection without leaking secrets', async () => {
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async () => {
      throw new Error(
        `connection refused MINIO_SECRET_KEY=hunter2 minio_token='very secret value' http://user:password@127.0.0.1:9000 ${SECRET_MARKERS[0]}`,
      );
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.error.includes('hunter2'), false);
  assert.equal(result.details.error.includes('very secret value'), false);
  assert.equal(result.details.error.includes('password@127.0.0.1'), false);
  assertNoSecretLeak(result);
});

test('checkMinioReadiness redacts secrets from endpoint diagnostics', async () => {
  const result = await checkMinioReadiness({
    config: {
      minio: {
        endpoint:
          'http://user:MINIO_SECRET_KEY=hunter2@127.0.0.1:9000/?access_token=abc123',
      },
    },
    fetchImpl: async () => {
      throw new Error('connection refused');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.endpoint.includes('hunter2'), false);
  assert.equal(result.details.endpoint.includes('abc123'), false);
  assertNoSecretLeak(result);
});

test('checkMinioReadiness passes an aborting timeout signal to fetch', async () => {
  let receivedSignal;
  const result = await withTimeout(
    checkMinioReadiness({
      config,
      fetchImpl: async (_url, options) => {
        receivedSignal = options?.signal;

        await new Promise((_resolve, reject) => {
          receivedSignal.addEventListener(
            'abort',
            () => reject(receivedSignal.reason),
            { once: true },
          );
        });
      },
      requestTimeoutMs: 10,
    }),
    1_000,
    'checkMinioReadiness did not abort fetch',
  );

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
});

test('checkMinioReadiness times out a fetch implementation that ignores abort signal', async () => {
  let receivedSignal;
  let rejectLateFetch;
  const startedAt = Date.now();
  const result = await withTimeout(
    checkMinioReadiness({
      config,
      fetchImpl: async (_url, options) => {
        receivedSignal = options?.signal;

        return new Promise((_resolve, reject) => {
          rejectLateFetch = reject;
        });
      },
      requestTimeoutMs: 10,
    }),
    500,
    'checkMinioReadiness did not enforce requestTimeoutMs',
  );

  const elapsedMs = Date.now() - startedAt;

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assert.equal(result.details.error, 'MinIO readiness request timed out');
  assert.equal(elapsedMs >= 8, true);
  assert.equal(elapsedMs < 500, true);

  rejectLateFetch(new Error('late fetch rejection'));
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
});

test('checkMinioReadiness keeps stable diagnostics when fetch rejects after timeout abort', async () => {
  let receivedSignal;
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async (_url, options) => {
      receivedSignal = options?.signal;

      return new Promise((_resolve, reject) => {
        receivedSignal.addEventListener(
          'abort',
          () => {
            setImmediate(() => {
              reject(new Error('implementation-specific abort message'));
            });
          },
          { once: true },
        );
      });
    },
    requestTimeoutMs: 10,
  });

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.details.error, 'MinIO readiness request timed out');
});

test('checkMinioReadiness keeps stable diagnostics when fetch rejects synchronously on timeout abort', async () => {
  let receivedSignal;
  const result = await checkMinioReadiness({
    config,
    fetchImpl: async (_url, options) => {
      receivedSignal = options?.signal;

      return new Promise((_resolve, reject) => {
        receivedSignal.addEventListener(
          'abort',
          () => {
            reject(new Error('synchronous abort rejection'));
          },
          { once: true },
        );
      });
    },
    requestTimeoutMs: 10,
  });

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.details.error, 'MinIO readiness request timed out');
});

test('checkMinioReadiness validates request timeout', async () => {
  await assert.rejects(
    () =>
      checkMinioReadiness({
        config,
        requestTimeoutMs: 0,
      }),
    /requestTimeoutMs/,
  );
  await assert.rejects(
    () =>
      checkMinioReadiness({
        config,
        requestTimeoutMs: -1,
      }),
    /requestTimeoutMs/,
  );
  await assert.rejects(
    () =>
      checkMinioReadiness({
        config,
        requestTimeoutMs: Number.NaN,
      }),
    /requestTimeoutMs/,
  );
});

test('waitForMinioReadiness retries until ready', async () => {
  let attempts = 0;
  const result = await waitForMinioReadiness({
    checkReadiness: async () => {
      attempts += 1;
      return attempts === 2
        ? { code: 'OK', message: 'ok', ok: true }
        : { code: 'FAILED', message: 'failed', ok: false };
    },
    intervalMs: 1,
    timeoutMs: 100,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'OK');
  assert.equal(result.message, 'ok');
  assert.equal(attempts, 2);
});

test('waitForMinioReadiness returns timeout after repeated failures exhaust the deadline', async () => {
  let attempts = 0;

  const result = await waitForMinioReadiness({
    checkReadiness: async () => {
      attempts += 1;

      return {
        code: `FAILED_${attempts}`,
        details: {
          attempt: attempts,
        },
        message: `failed ${attempts}`,
        ok: false,
      };
    },
    intervalMs: 1,
    timeoutMs: 5,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
  assert.equal(
    result.message,
    'Timed out while waiting for MinIO readiness',
  );
  assert.equal(attempts > 0, true);
});

test('waitForMinioReadiness times out a never-settling readiness check', async () => {
  const startedAt = Date.now();
  const result = await waitForMinioReadiness({
    checkReadiness: async () => new Promise(() => undefined),
    intervalMs: 1,
    timeoutMs: 20,
  });
  const elapsedMs = Date.now() - startedAt;

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
  assert.equal(elapsedMs >= 15, true);
  assert.equal(elapsedMs < 500, true);
});

test('waitForMinioReadiness aborts a timed-out readiness check', async () => {
  let receivedSignal;
  let aborted = false;

  const result = await waitForMinioReadiness({
    checkReadiness: async ({ signal }) => {
      receivedSignal = signal;
      signal.addEventListener(
        'abort',
        () => {
          aborted = true;
        },
        { once: true },
      );

      return new Promise(() => undefined);
    },
    intervalMs: 1,
    timeoutMs: 20,
  });

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
});

test('waitForMinioReadiness keeps timeout result when operation resolves during timeout abort', async () => {
  const result = await waitForMinioReadiness({
    checkReadiness: async ({ signal }) =>
      new Promise((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            resolve({
              code: 'MINIO_READINESS_FAILED',
              message: 'implementation-specific abort result',
              ok: false,
            });
          },
          { once: true },
        );
      }),
    intervalMs: 1,
    timeoutMs: 20,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
});

test('waitForMinioReadiness aborts the current attempt when the outer signal aborts', async () => {
  const abortController = new AbortController();
  let receivedSignal;
  let attemptAborted = false;
  const wait = waitForMinioReadiness({
    checkReadiness: async ({ signal }) => {
      receivedSignal = signal;
      signal.addEventListener(
        'abort',
        () => {
          attemptAborted = true;
        },
        { once: true },
      );
      attemptAborted ||= signal.aborted;

      return new Promise(() => undefined);
    },
    signal: abortController.signal,
    timeoutMs: 1_000,
  });

  abortController.abort(new Error('stop waiting'));

  const result = await withTimeout(
    wait,
    100,
    'waitForMinioReadiness did not stop after outer abort',
  );

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(attemptAborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_ABORTED');
});

test('waitForMinioReadiness keeps aborted result when operation resolves during outer abort', async () => {
  const abortController = new AbortController();
  const wait = waitForMinioReadiness({
    checkReadiness: async ({ signal }) =>
      new Promise((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            resolve({
              code: 'MINIO_READINESS_FAILED',
              message: 'implementation-specific abort result',
              ok: false,
            });
          },
          { once: true },
        );
      }),
    signal: abortController.signal,
    timeoutMs: 1_000,
  });

  abortController.abort(new Error('stop waiting'));

  const result = await withTimeout(
    wait,
    100,
    'waitForMinioReadiness did not stop after outer abort',
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_ABORTED');
});

test('waitForMinioReadiness handles readiness check rejection before retrying', async () => {
  let attempts = 0;

  const result = await waitForMinioReadiness({
    checkReadiness: async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error(`readiness failed ${SECRET_MARKERS[0]}`);
      }

      return {
        code: 'OK',
        message: 'ok',
        ok: true,
      };
    },
    intervalMs: 1,
    timeoutMs: 100,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'OK');
  assert.equal(result.message, 'ok');
  assert.equal(attempts, 2);
});

test('waitForMinioReadiness validates timing options', async () => {
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        intervalMs: 0,
      }),
    /intervalMs/,
  );
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        intervalMs: -1,
      }),
    /intervalMs/,
  );
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        intervalMs: Number.NaN,
      }),
    /intervalMs/,
  );
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        timeoutMs: 0,
      }),
    /timeoutMs/,
  );
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        timeoutMs: -1,
      }),
    /timeoutMs/,
  );
  await assert.rejects(
    () =>
      waitForMinioReadiness({
        checkReadiness: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        timeoutMs: Number.NaN,
      }),
    /timeoutMs/,
  );
});

async function withTimeout(promise, timeoutMs, message) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
