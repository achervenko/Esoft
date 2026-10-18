import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, '../../../..');

test('setup rate limit is shared, persistent, atomic and bounded in PostgreSQL', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 120000,
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { SetupRateLimitService } = require('../../../../backend/dist/src/setup/setup-rate-limit.service.js');
  const environment = await createIsolatedPostgres();
  const clients = [];
  const makeClient = (url) => {
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    clients.push(client);
    return client;
  };
  const isLimited = (error) => error.getStatus() === 429 && error.getResponse().code === 'SETUP_RATE_LIMITED';
  try {
    const root = join(environment.root, 'setup_limit');
    await mkdir(join(root, 'backend/prisma/packages'), { recursive: true });
    await cp(join(project, 'backend/prisma/packages/core'), join(root, 'backend/prisma/packages/core'), { recursive: true });
    await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
    await writeFile(join(root, 'database-packages.json'), '{"modules":[]}');
    const database = await environment.database('setup_limit');
    const url = environment.urlFor('setup_limit');
    const migration = await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'deploy', output: { log() {} } });
    assert.equal(migration.ok, true, migration.stderr || migration.stdout);
    await environment.adminQuery('CREATE ROLE setup_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
    await database.query('GRANT USAGE ON SCHEMA public TO setup_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON setup_rate_limits TO setup_runtime');
    const runtimeUrl = environment.urlFor('setup_limit', 'setup_runtime');
    const first = makeClient(runtimeUrl);
    const second = makeClient(runtimeUrl);
    const services = [new SetupRateLimitService(first), new SetupRateLimitService(second)];
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => services[i % 2].consume('192.0.2.1')));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
    for (const result of results.filter((r) => r.status === 'rejected')) assert.ok(isLimited(result.reason));
    assert.equal((await database.query('SELECT attempts FROM setup_rate_limits')).rows[0].attempts, 6);
    await first.$disconnect();
    const restarted = new SetupRateLimitService(makeClient(runtimeUrl));
    await assert.rejects(restarted.consume('192.0.2.1'), isLimited);
    await assert.rejects(restarted.consume('::ffff:192.0.2.1'), isLimited);
    for (let i = 0; i < 5; i++) await restarted.consume(i % 2 ? '2001:db8::1' : '2001:0db8:0:0:0:0:0:1');
    await assert.rejects(restarted.consume('2001:db8::1'), isLimited);
    await database.query('TRUNCATE setup_rate_limits');
    await database.query(`INSERT INTO setup_rate_limits(key,attempts,reset_at)
      SELECT md5(n::text),1,clock_timestamp()+interval '10 minutes' FROM generate_series(1,4095) n`);
    await restarted.consume('192.0.2.2');
    await assert.rejects(restarted.consume('192.0.2.3'), isLimited);
    await restarted.consume('192.0.2.2');
    assert.equal((await database.query('SELECT count(*)::int AS count FROM setup_rate_limits')).rows[0].count, 4096);
    await database.query("UPDATE setup_rate_limits SET reset_at=clock_timestamp()-interval '1 second'");
    await restarted.consume('192.0.2.3');
    assert.equal((await database.query('SELECT count(*)::int AS count FROM setup_rate_limits')).rows[0].count, 1);
    await assert.rejects(database.query('UPDATE setup_rate_limits SET attempts=0'), { code: '23514' });
    await assert.rejects(database.query('UPDATE setup_rate_limits SET attempts=7'), { code: '23514' });
    const unavailable = new SetupRateLimitService({ $transaction: async () => { throw new Error('Database unavailable'); } });
    await assert.rejects(unavailable.consume('192.0.2.4'), /Database unavailable/);
    await assert.rejects(restarted.consume(null), isLimited);
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    await environment.close();
  }
});
