import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkPostgresConnection,
  waitForPostgres,
} from '../../../../scripts/infrastructure/postgres/connection.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const config = {
  database: {
    url: 'postgresql://user:password@127.0.0.1:5432/esoft',
  },
};

test('checkPostgresConnection returns success and closes the client', async () => {
  const calls = [];
  class PgClient {
    constructor(options) {
      calls.push(['constructor', options]);
    }

    async connect() {
      calls.push(['connect']);
    }

    async query(sql) {
      calls.push(['query', sql]);
    }

    async end() {
      calls.push(['end']);
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'POSTGRES_CONNECTION_OK');
  assert.deepEqual(calls, [
    [
      'constructor',
      {
        connectionString: config.database.url,
        connectionTimeoutMillis: 3_000,
      },
    ],
    ['connect'],
    ['query', 'SELECT 1'],
    ['end'],
  ]);
});

test('checkPostgresConnection returns failure and closes after errors', async () => {
  let ended = false;
  class PgClient {
    async connect() {
      throw new Error('authentication failed');
    }

    async end() {
      ended = true;
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(ended, true);
});

test('checkPostgresConnection closes the client after query failure', async () => {
  const calls = [];
  class PgClient {
    async connect() {
      calls.push('connect');
    }

    async query() {
      calls.push('query');
      throw new Error('query failed');
    }

    async end() {
      calls.push('end');
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(calls, ['connect', 'query', 'end']);
  assert.equal(result.details.error, 'query failed');
});

test('checkPostgresConnection reports client close failure', async () => {
  class PgClient {
    async connect() {}

    async query() {}

    async end() {
      throw new Error('close failed');
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'close failed');
});

test('checkPostgresConnection preserves primary and close errors', async () => {
  class PgClient {
    async connect() {}

    async query() {
      throw new Error('query failed');
    }

    async end() {
      throw new Error('close failed');
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(result.details, {
    closeError: 'close failed',
    error: 'query failed',
  });
});

test('checkPostgresConnection preserves primary and forced termination errors', async () => {
  class PgClient {
    async connect() {}

    async query() {
      throw new Error('query failed');
    }

    async end() {
      return new Promise(() => undefined);
    }
  }

  const result = await checkPostgresConnection({
    closeTimeoutMs: 20,
    config,
    PgClient,
    terminateClient: () => {
      throw new TypeError('PgClient transport cannot be forcibly terminated');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(result.details, {
    closeError: 'PostgreSQL close timed out',
    error: 'query failed',
    terminationError: 'PgClient transport cannot be forcibly terminated',
  });
});

test('checkPostgresConnection does not leak database secrets', async () => {
  class PgClient {
    async connect() {
      throw new Error(
        `authentication failed DATABASE_PASSWORD=hunter2 database_url=postgresql://user:pass@host/db AccessToken=abc123 ${SECRET_MARKERS[0]}`,
      );
    }

    async end() {}
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.error.includes('hunter2'), false);
  assert.equal(
    result.details.error.includes('postgresql://user:pass@host/db'),
    false,
  );
  assert.equal(result.details.error.includes('abc123'), false);
  assertNoSecretLeak(result);
});

test('checkPostgresConnection handles client construction failure', async () => {
  class PgClient {
    constructor() {
      throw new Error('client construction failed');
    }
  }

  const result = await checkPostgresConnection({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'client construction failed');
});

test('checkPostgresConnection aborts a pending query and closes the client', async () => {
  const abortController = new AbortController();
  let ended = false;

  class PgClient {
    async connect() {}

    async query() {
      abortController.abort();
      return new Promise(() => undefined);
    }

    async end() {
      ended = true;
    }
  }

  const result = await checkPostgresConnection({
    config,
    PgClient,
    signal: abortController.signal,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'PostgreSQL query aborted');
  assert.equal(ended, true);
});

test('checkPostgresConnection times out a pending query and closes the client', async () => {
  const startedAt = Date.now();
  let ended = false;

  class PgClient {
    async connect() {}

    async query() {
      return new Promise(() => undefined);
    }

    async end() {
      ended = true;
    }
  }

  const result = await checkPostgresConnection({
    config,
    PgClient,
    queryTimeoutMs: 20,
  });
  const elapsedMs = Date.now() - startedAt;

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'PostgreSQL query timed out');
  assert.equal(ended, true);
  assert.equal(elapsedMs < 500, true);
});

test('checkPostgresConnection waits for abort-started close before returning', async () => {
  const abortController = new AbortController();
  let releaseClose;
  let returned = false;

  class PgClient {
    async connect() {}

    async query() {
      abortController.abort();
      return new Promise(() => undefined);
    }

    async end() {
      await new Promise((resolveClose) => {
        releaseClose = resolveClose;
      });
    }
  }

  const check = checkPostgresConnection({
    closeTimeoutMs: 1_000,
    config,
    PgClient,
    signal: abortController.signal,
  }).then((result) => {
    returned = true;
    return result;
  });

  await new Promise((resolveTick) => {
    setImmediate(resolveTick);
  });
  assert.equal(returned, false);
  assert.equal(typeof releaseClose, 'function');

  releaseClose();
  const result = await check;

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.error, 'PostgreSQL query aborted');
  assert.equal(returned, true);
});

test('checkPostgresConnection reports client close timeout', async () => {
  let destroyed = false;
  let clientInstance;

  class PgClient {
    constructor() {
      clientInstance = this;
    }

    async connect() {}

    async query() {}

    async end() {
      return new Promise(() => undefined);
    }
  }

  const result = await checkPostgresConnection({
    closeTimeoutMs: 20,
    config,
    PgClient,
    terminateClient: (client) => {
      assert.equal(client, clientInstance);
      destroyed = true;
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'PostgreSQL close timed out');
  assert.equal(destroyed, true);
});

test('checkPostgresConnection reports forced termination failure', async () => {
  class PgClient {
    async connect() {}

    async query() {}

    async end() {
      return new Promise(() => undefined);
    }
  }

  const result = await checkPostgresConnection({
    closeTimeoutMs: 20,
    config,
    PgClient,
    terminateClient: () => {
      throw new TypeError('PgClient transport cannot be forcibly terminated');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(result.details, {
    error: 'PostgreSQL close timed out',
    terminationError: 'PgClient transport cannot be forcibly terminated',
  });
});

test('checkPostgresConnection does not inspect client internals without a terminator', async () => {
  class PgClient {
    get connection() {
      throw new Error('internal connection should not be inspected');
    }

    async connect() {}

    async query() {}

    async end() {
      return new Promise(() => undefined);
    }
  }

  const result = await checkPostgresConnection({
    closeTimeoutMs: 20,
    config,
    PgClient,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_FAILED');
  assert.equal(result.details.error, 'PostgreSQL close timed out');
});

test('waitForPostgres retries until success', async () => {
  let attempts = 0;
  const result = await waitForPostgres({
    checkConnection: async () => {
      attempts += 1;
      return attempts === 3
        ? { code: 'OK', message: 'ok', ok: true }
        : { code: 'FAILED', message: 'failed', ok: false };
    },
    intervalMs: 1,
    timeoutMs: 100,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'OK');
  assert.equal(result.message, 'ok');
  assert.equal(attempts, 3);
});

test('waitForPostgres returns timeout after repeated failures exhaust the deadline', async () => {
  let attempts = 0;

  const result = await waitForPostgres({
    checkConnection: async () => {
      attempts += 1;

      return {
        code: `POSTGRES_FAILED_${attempts}`,
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
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
  assert.equal(
    result.message,
    'Timed out while waiting for PostgreSQL connection',
  );
  assert.equal(attempts > 0, true);
});

test('waitForPostgres times out a never-settling connection check', async () => {
  const startedAt = Date.now();
  const result = await waitForPostgres({
    abortCleanupTimeoutMs: 20,
    checkConnection: async () => new Promise(() => undefined),
    intervalMs: 1,
    timeoutMs: 20,
  });
  const elapsedMs = Date.now() - startedAt;

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
  assert.equal(elapsedMs >= 15, true);
  assert.equal(elapsedMs < 500, true);
});

test('waitForPostgres aborts a timed-out connection check', async () => {
  let receivedSignal;
  let aborted = false;

  const result = await waitForPostgres({
    abortCleanupTimeoutMs: 20,
    checkConnection: async ({ signal }) => {
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
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
});

test('waitForPostgres waits for aborted connection check cleanup', async () => {
  let cleanupCompleted = false;
  let returned = false;

  const wait = waitForPostgres({
    abortCleanupTimeoutMs: 100,
    checkConnection: async ({ signal }) => {
      await new Promise((resolveCleanup) => {
        signal.addEventListener(
          'abort',
          () => {
            setTimeout(() => {
              cleanupCompleted = true;
              resolveCleanup();
            }, 20);
          },
          { once: true },
        );
      });

      return {
        code: 'POSTGRES_CONNECTION_FAILED',
        message: 'Connection failed',
        ok: false,
      };
    },
    intervalMs: 1,
    timeoutMs: 10,
  }).then((result) => {
    returned = true;
    return result;
  });

  await new Promise((resolveTick) => {
    setTimeout(resolveTick, 15);
  });
  assert.equal(returned, false);

  const result = await wait;

  assert.equal(cleanupCompleted, true);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
});

test('waitForPostgres returns timeout when abort synchronously resolves the operation', async () => {
  const result = await waitForPostgres({
    abortCleanupTimeoutMs: 20,
    checkConnection: async ({ signal }) =>
      new Promise((resolveConnection) => {
        signal.addEventListener(
          'abort',
          () => {
            resolveConnection({
              code: 'OK',
              message: 'ok',
              ok: true,
            });
          },
          { once: true },
        );
      }),
    intervalMs: 1,
    timeoutMs: 10,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
});

test('waitForPostgres aborts checkPostgresConnection after timeout', async () => {
  let ended = false;

  class PgClient {
    async connect() {}

    async query() {
      return new Promise(() => undefined);
    }

    async end() {
      ended = true;
    }
  }

  const result = await waitForPostgres({
    abortCleanupTimeoutMs: 100,
    checkConnection: ({ signal }) =>
      checkPostgresConnection({
        config,
        PgClient,
        queryTimeoutMs: 1_000,
        signal,
      }),
    intervalMs: 1,
    timeoutMs: 20,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_CONNECTION_TIMEOUT');
  assert.equal(ended, true);
});

test('waitForPostgres handles connection check rejection before retrying', async () => {
  let attempts = 0;

  const result = await waitForPostgres({
    checkConnection: async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error('connection check failed');
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

test('waitForPostgres clears the attempt timeout after early success', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Set();
  let cleared = 0;

  globalThis.setTimeout = (...args) => {
    const timer = originalSetTimeout(...args);
    timers.add(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    if (timers.has(timer)) {
      cleared += 1;
      timers.delete(timer);
    }

    return originalClearTimeout(timer);
  };

  try {
    const result = await waitForPostgres({
      checkConnection: async () => ({
        code: 'OK',
        message: 'ok',
        ok: true,
      }),
      intervalMs: 1,
      timeoutMs: 1_000,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.code, 'OK');
    assert.equal(cleared, 1);
    assert.equal(timers.size, 0);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('waitForPostgres validates timing options', async () => {
  await assert.rejects(
    () =>
      waitForPostgres({
        abortCleanupTimeoutMs: 0,
        checkConnection: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
      }),
    /abortCleanupTimeoutMs/,
  );
  await assert.rejects(
    () =>
      waitForPostgres({
        abortCleanupTimeoutMs: Number.NaN,
        checkConnection: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
      }),
    /abortCleanupTimeoutMs/,
  );
  await assert.rejects(
    () =>
      waitForPostgres({
        checkConnection: async () => ({
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
      waitForPostgres({
        checkConnection: async () => ({
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
      waitForPostgres({
        checkConnection: async () => ({
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
      waitForPostgres({
        checkConnection: async () => ({
          code: 'FAILED',
          message: 'failed',
          ok: false,
        }),
        timeoutMs: Number.NaN,
      }),
    /timeoutMs/,
  );
});
