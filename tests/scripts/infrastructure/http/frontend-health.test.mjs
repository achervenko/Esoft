import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkFrontendHttp,
  waitForFrontendHttp,
} from '../../../../scripts/infrastructure/http/frontend-health.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const config = {
  frontend: {
    url: 'http://127.0.0.1:5173',
  },
};

test('checkFrontendHttp returns success for HTML response', async () => {
  const result = await checkFrontendHttp({
    config,
    fetchImpl: async (url) => {
      assert.equal(url, config.frontend.url);
      return response(200, 'text/html; charset=utf-8');
    },
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'FRONTEND_HTTP_OK');
  assert.equal(result.details.status, 200);
  assert.equal(result.details.contentType, 'text/html; charset=utf-8');
});

test('checkFrontendHttp reports an HTTP error', async () => {
  const result = await checkFrontendHttp({
    config,
    fetchImpl: async () => response(500, 'text/html'),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'FRONTEND_HTTP_FAILED');
  assert.deepEqual(result.details, {
    status: 500,
  });
});

test('checkFrontendHttp distinguishes invalid content type', async () => {
  const result = await checkFrontendHttp({
    config,
    fetchImpl: async () => response(200, 'application/json'),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'FRONTEND_CONTENT_TYPE_INVALID');
  assert.equal(result.details.status, 200);
  assert.equal(result.details.contentType, 'application/json');
});

test('checkFrontendHttp handles missing fetch implementation', async () => {
  const result = await checkFrontendHttp({
    config,
    fetchImpl: null,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'FRONTEND_HTTP_UNREACHABLE');
});

test('checkFrontendHttp handles fetch rejection without leaking secrets', async () => {
  const result = await checkFrontendHttp({
    config,
    fetchImpl: async () => {
      throw new Error(`connection refused ${SECRET_MARKERS[0]}`);
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'FRONTEND_HTTP_UNREACHABLE');
  assertNoSecretLeak(result);
});

test('checkFrontendHttp passes an aborting timeout signal to fetch', async () => {
  let receivedSignal;
  const result = await withTimeout(
    checkFrontendHttp({
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
    'checkFrontendHttp did not abort fetch',
  );

  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(receivedSignal.aborted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'FRONTEND_HTTP_UNREACHABLE');
});

test('checkFrontendHttp validates request timeout', async () => {
  await assert.rejects(
    () =>
      checkFrontendHttp({
        config,
        requestTimeoutMs: -1,
      }),
    /requestTimeoutMs/,
  );
});

test('waitForFrontendHttp returns the last result on timeout', async () => {
  let attempts = 0;
  const result = await waitForFrontendHttp({
    checkFrontend: async () => {
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
  assert.equal(result.code, `FAILED_${attempts}`);
  assert.equal(result.message, `failed ${attempts}`);
  assert.deepEqual(result.details, {
    attempt: attempts,
  });
});

test('waitForFrontendHttp retries until frontend is reachable', async () => {
  let attempts = 0;
  const result = await waitForFrontendHttp({
    checkFrontend: async () => {
      attempts += 1;

      return attempts === 2
        ? { code: 'FRONTEND_OK', message: 'Frontend is ready', ok: true }
        : { code: 'NOT_READY', message: 'Not ready', ok: false };
    },
    intervalMs: 1,
    timeoutMs: 100,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'FRONTEND_OK');
  assert.equal(attempts, 2);
});

test('waitForFrontendHttp validates timing options', async () => {
  await assert.rejects(
    () =>
      waitForFrontendHttp({
        checkFrontend: async () => ({
          code: 'OK',
          message: 'ok',
          ok: true,
        }),
        intervalMs: 0,
      }),
    /intervalMs/,
  );

  await assert.rejects(
    () =>
      waitForFrontendHttp({
        checkFrontend: async () => ({
          code: 'OK',
          message: 'ok',
          ok: true,
        }),
        timeoutMs: -1,
      }),
    /timeoutMs/,
  );
});

function response(status, contentType) {
  return {
    headers: new Headers({ 'content-type': contentType }),
    ok: status >= 200 && status < 300,
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
