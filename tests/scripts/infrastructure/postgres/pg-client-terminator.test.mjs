import assert from 'node:assert/strict';
import test from 'node:test';

import { terminatePgClient } from '../../../../scripts/infrastructure/postgres/pg-client-terminator.mjs';

test('terminatePgClient destroys the node-postgres stream when available', () => {
  let destroyed = false;

  terminatePgClient({
    connection: {
      stream: {
        destroy() {
          destroyed = true;
        },
      },
    },
  });

  assert.equal(destroyed, true);
});

test('terminatePgClient rejects clients without a destroyable stream', () => {
  assert.throws(
    () => terminatePgClient({}),
    /PgClient transport cannot be forcibly terminated/,
  );
});

test('terminatePgClient propagates stream destroy errors', () => {
  assert.throws(
    () =>
      terminatePgClient({
        connection: {
          stream: {
            destroy() {
              throw new Error('destroy failed');
            },
          },
        },
      }),
    /destroy failed/,
  );
});
