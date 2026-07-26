import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkBackendHealth,
  waitForBackendHealth,
} from '../../../../scripts/infrastructure/http/backend-health.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const config = {
  backend: {
    url: 'http://127.0.0.1:3000/',
  },
};

test('checkBackendHealth returns success for 200 JSON response', async () => {
  const result = await checkBackendHealth({
    config,
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:3000/health');
      return jsonResponse(200, { status: 'ok' });
    },
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'BACKEND_HEALTH_OK');
  assert.deepEqual(result.details.body, { status: 'ok' });
});

test('checkBackendHealth appends health path when backend url has no trailing slash', async () => {
  const result = await checkBackendHealth({
    config: {
      backend: {
        url: 'http://127.0.0.1:3000',
      },
    },
    fetchImpl: async (url) => {
      assert.equal(url, 'http://127.0.0.1:3000/health');
      return jsonResponse(200, { status: 'ok' });
    },
  });

  assertOperationResult(result, { ok: true });
});

test('checkBackendHealth returns expected-status result for 503', async () => {
  const result = await checkBackendHealth({
    config,
    expectedStatus: 503,
    fetchImpl: async () => jsonResponse(503, { status: 'error' }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'BACKEND_HEALTH_EXPECTED_STATUS');
  assert.equal(result.details.status, 503);
});

test('checkBackendHealth treats 503 as unavailable without expectedStatus', async () => {
  const result = await checkBackendHealth({
    config,
    fetchImpl: async () => jsonResponse(503, { status: 'error' }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_HEALTH_UNAVAILABLE');
  assert.equal(result.details.status, 503);
});

test('checkBackendHealth reports an unexpected HTTP status', async () => {
  const result = await checkBackendHealth({
    config,
    fetchImpl: async () => jsonResponse(500, { status: 'error' }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_HEALTH_FAILED');
  assert.equal(result.details.status, 500);
  assert.deepEqual(result.details.body, { status: 'error' });
});

test('checkBackendHealth handles missing fetch implementation', async () => {
  const result = await checkBackendHealth({
    config,
    fetchImpl: null,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_HEALTH_UNREACHABLE');
});

test('checkBackendHealth handles fetch rejection without leaking secret markers', async () => {
  const result = await checkBackendHealth({
    config,
    fetchImpl: async () => {
      throw new Error(`connection refused ${SECRET_MARKERS[0]}`);
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_HEALTH_UNREACHABLE');
  assertNoSecretLeak(result);
});

test('checkBackendHealth passes an aborting timeout signal to fetch', async () => {
  let receivedSignal;
  const result = await withTimeout(
    checkBackendHealth({
      config,
      fetchImpl: async (_url, options) => {
        receivedSignal = options?.signal;

        await new Promise((resolve, reject) => {
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
    'checkBackendHealth did not abort fetch',
  );

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_HEALTH_UNREACHABLE');
});

test('waitForBackendHealth retries until health is ok', async () => {
  let attempts = 0;
  const result = await waitForBackendHealth({
    checkHealth: async () => {
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

test('waitForBackendHealth returns the last failure after timeout', async () => {
  const result = await waitForBackendHealth({
    checkHealth: async () => ({
      code: 'BACKEND_NOT_READY',
      details: {
        status: 503,
      },
      message: 'Backend is not ready',
      ok: false,
    }),
    intervalMs: 1,
    timeoutMs: 5,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'BACKEND_NOT_READY');
  assert.deepEqual(result.details, { status: 503 });
});

test('waitForBackendHealth validates timing options', async () => {
  await assert.rejects(
    () =>
      waitForBackendHealth({
        checkHealth: async () => ({ code: 'OK', message: 'ok', ok: true }),
        intervalMs: 0,
      }),
    /intervalMs/,
  );
  await assert.rejects(
    () =>
      waitForBackendHealth({
        checkHealth: async () => ({ code: 'OK', message: 'ok', ok: true }),
        timeoutMs: -1,
      }),
    /timeoutMs/,
  );
});

function jsonResponse(status, body) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    status,
  };
}

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
