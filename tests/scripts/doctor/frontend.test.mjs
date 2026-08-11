import assert from 'node:assert/strict';
import test from 'node:test';

import { checkFrontend } from '../../../scripts/doctor/frontend.mjs';

test('checkFrontend starts frontend through npm invocation and preserves readiness flow', async () => {
  const calls = [];
  const entries = [];

  await withMockFetch([
    async (url) => {
      assert.equal(url, 'http://127.0.0.1:5173');
      throw new Error('not running');
    },
    async (url) => {
      assert.equal(url, 'http://127.0.0.1:5173');

      return htmlResponse(200);
    },
  ], async () => {
    const result = await checkFrontend({
      config: frontendConfig(),
      npmArgs: (args) => [...args],
      npmInvocation: {
        command: 'C:/Program Files/nodejs/node.exe',
        argsPrefix: [
          'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
        ],
      },
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
  assert.equal(calls[0][0], 'frontend');
  assert.equal(calls[0][1], 'C:/Program Files/nodejs/node.exe');
  assert.deepEqual(calls[0][2], [
    'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
    'run',
    'dev',
    '--workspace',
    'frontend',
  ]);
  assert.equal(calls[0][1].endsWith('.cmd'), false);
  assert.deepEqual(calls[0][3], { ports: [5173] });
  assert.equal(
    entries.some(
      ([section, status, message]) =>
        section === 'Frontend' &&
        status === 'INFO' &&
        message === 'Frontend process started; waiting for HTTP endpoint',
    ),
    true,
  );
  assert.equal(
    entries.some(
      ([section, status, message]) =>
        section === 'Frontend' &&
        status === 'OK' &&
        message === 'HTML response',
    ),
    true,
  );
});

function frontendConfig() {
  return {
    frontend: {
      port: 5173,
      url: 'http://127.0.0.1:5173',
    },
  };
}

function htmlResponse(status) {
  return {
    headers: {
      get: (name) =>
        name.toLowerCase() === 'content-type'
          ? 'text/html; charset=utf-8'
          : '',
    },
    ok: status >= 200 && status < 300,
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
