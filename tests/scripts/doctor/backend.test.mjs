import assert from 'node:assert/strict';
import test from 'node:test';

import { checkBackend } from '../../../scripts/doctor/backend.mjs';

test('checkBackend starts backend through npm invocation and preserves readiness flow', async () => {
  const calls = [];
  const entries = [];

  await withMockFetch([
    async (url) => {
      assert.equal(url, 'http://127.0.0.1:3000/api/health');
      throw new Error('not running');
    },
    async (url) => {
      assert.equal(url, 'http://127.0.0.1:3000/api/health');

      return jsonResponse(200, {
      dependencies: {
        minio: 'ok',
        postgres: 'ok',
      },
      });
    },
  ], async () => {
    const result = await checkBackend({
      config: backendConfig(),
      minio: { dependencyOk: true },
      npmArgs: (args) => [...args],
      npmInvocation: {
        command: 'C:/Program Files/nodejs/node.exe',
        argsPrefix: [
          'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
        ],
      },
      postgres: { dependencyOk: true },
      report: {
        addSection: () => undefined,
        add: (...args) => entries.push(args),
      },
      startManagedProcess: async (...args) => {
        calls.push(args);
        return { ok: true };
      },
    });

    assert.deepEqual(result, { ok: true });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'backend');
  assert.equal(calls[0][1], 'C:/Program Files/nodejs/node.exe');
  assert.deepEqual(calls[0][2], [
    'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
    'run',
    'start',
    '--workspace',
    'backend',
  ]);
  assert.equal(calls[0][1].endsWith('.cmd'), false);
  assert.deepEqual(calls[0][3], { ports: [3000] });
  assert.equal(
    entries.some(
      ([section, status, message]) =>
        section === 'Backend' &&
        status === 'INFO' &&
        message === 'Backend process started; waiting for health endpoint',
    ),
    true,
  );
  assert.equal(
    entries.some(
      ([section, status, message]) =>
        section === 'Backend' &&
        status === 'OK' &&
        message === 'Health endpoint',
    ),
    true,
  );
});

function backendConfig() {
  return {
    backend: {
      port: 3000,
      url: 'https://insolution-esoft.ru',
      internalUrl: 'http://127.0.0.1:3000',
    },
  };
}

function jsonResponse(status, body) {
  return {
    headers: {
      get: (name) =>
        name.toLowerCase() === 'content-type'
          ? 'application/json'
          : '',
    },
    json: async () => body,
    status,
  };
}

async function withMockFetch(handlers, callback) {
  const previousFetch = globalThis.fetch;
  const queue = [...handlers];

  globalThis.fetch = async (...args) => {
    const handler = queue.shift();

    if (!handler) {
      throw new Error(`Unexpected fetch call ${args[0]}`);
    }

    return handler(...args);
  };

  try {
    await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}
