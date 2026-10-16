import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import packageTools from '../../../scripts/database/packages.cjs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Client } from 'pg';

const require = createRequire(import.meta.url);
const databaseUrl =
  process.env.ESOFT_TEST_DATABASE_URL ??
  require('../../../scripts/config/config-core.cjs').loadConfig().config
    .database.url;
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error('Numbering integration tests require local PostgreSQL');
}

test('identity preview and concurrent writes never rewind numbering', async () => {
  const database = `esoft_numbering_test_${process.pid}_${Date.now()}`;
  const admin = new Client({ connectionString: databaseUrl });
  const clients = [];
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const url = new URL(databaseUrl);
    url.pathname = `/${database}`;
    for (let index = 0; index < 4; index++) {
      const client = new Client({ connectionString: url.toString() });
      clients.push(client);
      await client.connect();
      await client.query("SET statement_timeout = '10s'");
    }
    const [a, b, c] = clients;
    const blockerPid = (await a.query('SELECT pg_backend_pid() pid')).rows[0]
      .pid;
    const waiterPid = (await b.query('SELECT pg_backend_pid() pid')).rows[0]
      .pid;
    const waitUntilBlocked = async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const result = await c.query(
          'SELECT $1::int = ANY(pg_blocking_pids($2::int)) blocked',
          [blockerPid, waiterPid],
        );
        if (result.rows[0].blocked) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.fail(
        'Concurrent query did not wait for the uncommitted numbering transaction',
      );
    };
    for (const migration of packageTools.readPackageSet(
      resolve(import.meta.dirname, '../../..'),
    ).migrations) {
      await a.query(migration.sql.toString('utf8'));
    }
    await a.query(`CREATE TABLE numbering_probe(id serial PRIMARY KEY);
      CREATE TRIGGER probe_lock BEFORE INSERT OR UPDATE OF id ON numbering_probe
      FOR EACH STATEMENT EXECUTE FUNCTION app_lock_identity_writes('id');
      CREATE TRIGGER probe_sync AFTER INSERT OR UPDATE OF id ON numbering_probe
      FOR EACH STATEMENT EXECUTE FUNCTION app_sync_identity_after_insert('id')`);
    const preview =
      "SELECT app_next_identity_id('numbering_probe'::regclass, 'id')::int n";
    const sync =
      "SELECT app_sync_identity_sequence('numbering_probe'::regclass, 'id')";
    assert.equal((await c.query(preview)).rows[0].n, 1);
    await a.query('INSERT INTO numbering_probe(id) VALUES(100)');
    await a.query('BEGIN');
    assert.equal(
      (await a.query('INSERT INTO numbering_probe DEFAULT VALUES RETURNING id'))
        .rows[0].id,
      101,
    );
    // Read-only preview sees the reserved sequence value, not only committed MAX.
    assert.equal((await c.query(preview)).rows[0].n, 102);
    const waiting = b.query(sync);
    await waitUntilBlocked();
    await a.query('COMMIT');
    await waiting;
    assert.equal(
      (await b.query('INSERT INTO numbering_probe DEFAULT VALUES RETURNING id'))
        .rows[0].id,
      102,
    );
    // Even a raw reservation that has no table row must survive synchronization.
    assert.equal(
      (await c.query("SELECT nextval('numbering_probe_id_seq')::int n")).rows[0]
        .n,
      103,
    );
    await b.query(sync);
    assert.equal(
      (await b.query('INSERT INTO numbering_probe DEFAULT VALUES RETURNING id'))
        .rows[0].id,
      104,
    );
    await a.query('BEGIN');
    await a.query('UPDATE numbering_probe SET id=1000 WHERE id=100');
    const pendingInsert = b.query(
      'INSERT INTO numbering_probe DEFAULT VALUES RETURNING id',
    );
    await waitUntilBlocked();
    await a.query('COMMIT');
    assert.equal((await pendingInsert).rows[0].id, 1001);
    await a.query('BEGIN');
    const rolledBack = (
      await a.query('INSERT INTO numbering_probe DEFAULT VALUES RETURNING id')
    ).rows[0].id;
    await a.query('ROLLBACK');
    await c.query(sync);
    assert(
      (await c.query('INSERT INTO numbering_probe DEFAULT VALUES RETURNING id'))
        .rows[0].id > rolledBack,
    );
    const allocated = await Promise.all(
      clients.map(async (client) => {
        const ids = [];
        for (let index = 0; index < 25; index++) {
          ids.push(
            (
              await client.query(
                'INSERT INTO numbering_probe DEFAULT VALUES RETURNING id',
              )
            ).rows[0].id,
          );
        }
        return ids;
      }),
    );
    assert.equal(new Set(allocated.flat()).size, 100);
    const before = (
      await c.query('SELECT last_value, is_called FROM numbering_probe_id_seq')
    ).rows[0];
    await Promise.all(clients.map((client) => client.query(preview)));
    assert.deepEqual(
      (
        await c.query(
          'SELECT last_value, is_called FROM numbering_probe_id_seq',
        )
      ).rows[0],
      before,
    );
  } finally {
    await Promise.all(clients.map((client) => client.end()));
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
});
