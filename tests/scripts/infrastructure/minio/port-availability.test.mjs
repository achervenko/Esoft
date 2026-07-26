import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  checkMinioPortsAvailable,
  checkPortAvailable,
} from '../../../../scripts/infrastructure/minio/port-availability.mjs';
import { assertOperationResult } from '../../helpers/operation-result.mjs';

test('checkMinioPortsAvailable returns success when both ports are available', async () => {
  const result = await checkMinioPortsAvailable({
    config: createConfig(),
    createServerImpl: createAvailableServer,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_PORTS_AVAILABLE');
});

test('checkMinioPortsAvailable reports EADDRINUSE as port conflict', async () => {
  const result = await checkMinioPortsAvailable({
    config: createConfig(),
    createServerImpl: () => createFailingServer('EADDRINUSE'),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_PORT_CONFLICT');
  assert.equal(result.details.port, 9000);
});

test('checkMinioPortsAvailable reports console port conflicts after closing API probe', async () => {
  const events = [];
  const result = await checkMinioPortsAvailable({
    config: createConfig(),
    createServerImpl: () => {
      if (events.length === 0) {
        return createAvailableServer({
          onClose: () => {
            events.push('api closed');
          },
        });
      }

      events.push('console checked');
      return createFailingServer('EADDRINUSE');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_PORT_CONFLICT');
  assert.equal(result.details.port, 9001);
  assert.deepEqual(events, ['api closed', 'console checked']);
});

test('checkMinioPortsAvailable reports non-conflict listen errors separately', async () => {
  const result = await checkMinioPortsAvailable({
    config: createConfig(),
    createServerImpl: () => createFailingServer('EACCES'),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_PORT_CHECK_FAILED');
  assert.equal(result.details.port, 9000);
  assert.equal(result.details.error, 'listen EACCES');
});

test('checkPortAvailable handles synchronous createServer exceptions', async () => {
  const result = await checkPortAvailable({
    createServerImpl: () => {
      throw new Error('createServer failed');
    },
    host: '127.0.0.1',
    port: 9000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'createServer failed');
});

test('checkPortAvailable handles synchronous listen exceptions', async () => {
  const result = await checkPortAvailable({
    createServerImpl: () => {
      const server = new EventEmitter();
      server.listen = () => {
        throw new Error('listen failed');
      };
      return server;
    },
    host: '127.0.0.1',
    port: 9000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'listen failed');
});

test('checkPortAvailable reports synchronous close exceptions', async () => {
  const result = await checkPortAvailable({
    createServerImpl: () =>
      createAvailableServer({
        close: () => {
          throw new Error('close failed');
        },
      }),
    host: '127.0.0.1',
    port: 9000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'close failed');
});

test('checkPortAvailable reports asynchronous close errors', async () => {
  const result = await checkPortAvailable({
    createServerImpl: () =>
      createAvailableServer({
        close: (callback) => {
          queueMicrotask(() => {
            callback(new Error('close callback failed'));
          });
        },
      }),
    host: '127.0.0.1',
    port: 9000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'close callback failed');
});

function createConfig() {
  return {
    minio: {
      consolePort: 9001,
      host: '127.0.0.1',
      port: 9000,
    },
  };
}

function createAvailableServer({ close, onClose } = {}) {
  const server = new EventEmitter();
  server.listen = (_port, _host, callback) => {
    queueMicrotask(() => {
      server.listening = true;
      callback();
    });
    return server;
  };
  server.close = close ?? ((callback) => {
    queueMicrotask(() => {
      server.listening = false;
      onClose?.();
      callback();
    });
  });
  server.listening = false;

  if (close) {
    const closeImpl = close;
    server.close = (callback) => {
      const result = closeImpl(callback);
      onClose?.();
      return result;
    };
  }

  return server;
}

function createFailingServer(code) {
  const server = new EventEmitter();
  server.listen = () => {
    queueMicrotask(() => {
      const error = new Error(`listen ${code}`);
      error.code = code;
      server.emit('error', error);
    });
    return server;
  };
  server.close = () => undefined;
  return server;
}
