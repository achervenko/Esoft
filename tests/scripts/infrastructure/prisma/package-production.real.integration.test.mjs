import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runCommand } from '../../../../scripts/infrastructure/commands/run-command.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';
import installationLock from '../../../../scripts/infrastructure/operations/installation-lock.cjs';
import { backupPostgresDatabase } from '../../../../scripts/prod/backup-prod.postgres.mjs';
import { restorePostgresDatabase } from '../../../../scripts/prod/restore-prod.postgres.mjs';

const project = resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const { Client } = require('pg');

test('production roles, actual migration CLI and dump/restore preserve package operation', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 180000,
}, async () => {
  const { PrismaClient, Prisma } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const environment = await createIsolatedPostgres();
  const report = [];
  const clients = [];
  try {
    await environment.adminQuery('CREATE ROLE migration_probe LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; CREATE ROLE runtime_probe LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
    const database = await environment.database('production_probe', { owner: 'migration_probe', unicode: true });
    await database.query(`REVOKE CONNECT,TEMPORARY ON DATABASE production_probe FROM PUBLIC;
      GRANT CONNECT ON DATABASE production_probe TO migration_probe,runtime_probe;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO runtime_probe;
      ALTER DEFAULT PRIVILEGES FOR ROLE migration_probe IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO runtime_probe;
      ALTER DEFAULT PRIVILEGES FOR ROLE migration_probe IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO runtime_probe;`);
    const root = join(environment.root, 'production_app');
    await mkdir(join(root, 'backend/prisma'), { recursive: true });
    await mkdir(join(root, 'frontend'));
    await writeFile(join(root, 'package.json'), '{"name":"isolated-production-probe"}');
    await cp(join(project, 'scripts'), join(root, 'scripts'), { recursive: true });
    await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
    await cp(join(project, 'backend/prisma/packages'), join(root, 'backend/prisma/packages'), { recursive: true });
    await writeFile(join(root, 'database-packages.json'), '{"modules":["equipment","ppe","warehouse"]}');
    const migrationUrl = new URL(environment.urlFor('production_probe', 'migration_probe'));
    migrationUrl.password = 'isolated-probe-password'; // Disposable trust-authenticated cluster only.
    await writeFile(join(root, '.env'), `NODE_ENV=production\nDATABASE_URL=${migrationUrl}\n`);
    const childEnv = { ...process.env, NODE_PATH: resolve(project, 'node_modules') };
    delete childEnv.NODE_TEST_CONTEXT;
    async function cli(operation) {
      const result = await runCommand(process.execPath, [join(root, 'scripts/database/migrate.mjs'), operation], { cwd: root, env: childEnv, timeoutMs: 45000 });
      report.push({ operation, code: result.code, stdout: result.stdout, stderr: result.stderr });
      return result;
    }
    assert.equal((await cli('status')).code, 1);
    const lease = installationLock.acquireInstallationLock({ projectRoot: root, operation: 'backend' });
    try {
      const blocked = await cli('deploy');
      assert.equal(blocked.code, 1);
      assert.match(blocked.stderr, /holds the lock/);
      assert.equal((await database.query("SELECT to_regclass('public._prisma_migrations') AS name")).rows[0].name, null);
    } finally { lease.release(); }
    const deployed = await cli('deploy');
    assert.equal(deployed.ok, true, deployed.stdout + deployed.stderr);
    assert.equal((await cli('status')).ok, true);
    const flags = (await database.query("SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='migration_probe'")).rows[0];
    assert.deepEqual(flags, { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: migrationUrl.toString() }) });
    const { seedSelectedDatabase } = require('../../../../backend/dist/prisma/seed/seed-selected.js');
    try {
      await seedSelectedDatabase(prisma, [{ id: 'core' }, { id: 'equipment' }, { id: 'ppe' }, { id: 'warehouse' }]);
      for (const model of Prisma.dmmf.datamodel.models) {
        const delegate = model.name[0].toLowerCase() + model.name.slice(1);
        const orderField = model.fields.find((field) => field.kind === 'scalar' && !field.isList).name;
        await prisma[delegate].findMany({ take: 1, orderBy: { [orderField]: 'asc' } });
      }
    }
    finally { await prisma.$disconnect(); }
    await database.query('REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM runtime_probe');
    const runtime = new Client({ connectionString: environment.urlFor('production_probe', 'runtime_probe') });
    await runtime.connect(); clients.push(runtime);
    assert.ok((await runtime.query('SELECT count(*)::int AS count FROM countries')).rows[0].count >= 200);
    await runtime.query("INSERT INTO positions(name) VALUES ('Runtime position'); INSERT INTO employees(last_name,first_name,position_id) SELECT 'Runtime','Employee',id FROM positions WHERE name='Runtime position'");
    await assert.rejects(runtime.query("INSERT INTO ppe_employee_sizes(employee_id,shoe_size) SELECT id,99 FROM employees WHERE last_name='Runtime'"), { code: '23514' });
    await assert.rejects(runtime.query('CREATE TABLE forbidden_probe(id int)'), { code: '42501' });
    await assert.rejects(runtime.query('SELECT * FROM _prisma_migrations'), { code: '42501' });
    await runtime.query(`
      INSERT INTO "user"(id,name,email,"updatedAt") VALUES ('warehouse-runtime-issuer','Issuer','issuer@runtime.invalid',now());
      INSERT INTO warehouse_items(article,name,unit) VALUES ('RUNTIME-WH','Runtime item','шт');
      INSERT INTO warehouse_storage_locations(code,name) VALUES ('RUNTIME-LOCATION','Runtime shelf');
      INSERT INTO warehouse_balances(item_id,storage_location_id,quantity)
        SELECT i.id,l.id,5 FROM warehouse_items i CROSS JOIN warehouse_storage_locations l WHERE i.article='RUNTIME-WH' AND l.code='RUNTIME-LOCATION';
      INSERT INTO warehouse_issues(type,issued_by_user_id,comment,override_reservations)
        VALUES ('MANUAL','warehouse-runtime-issuer','Runtime override reason',true);
      INSERT INTO warehouse_issue_positions(issue_id,balance_id,quantity)
        SELECT i.id,b.id,0.125 FROM warehouse_issues i CROSS JOIN warehouse_balances b
        WHERE i.issued_by_user_id='warehouse-runtime-issuer';
    `);
    const warehouseIssuesBeforeBackup = (await runtime.query('SELECT * FROM warehouse_issues ORDER BY id')).rows;
    const warehousePositionsBeforeBackup = (await runtime.query('SELECT * FROM warehouse_issue_positions ORDER BY id')).rows;
    assert.equal(warehousePositionsBeforeBackup[0].quantity, '0.125');
    await assert.rejects(runtime.query('UPDATE warehouse_issue_positions SET quantity=0'), { code: '23514' });
    await assert.rejects(runtime.query("UPDATE warehouse_issues SET type='ISSUE_SHEET'"), { code: '23514' });
    const restoreTarget = await environment.database('restored_probe', { owner: 'migration_probe', unicode: true });
    const dump = join(environment.root, 'production.dump');
    const pgBin = process.env.ESOFT_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
    const exe = (name) => join(pgBin, process.platform === 'win32' ? `${name}.exe` : name);
    const config = { database: { url: migrationUrl.toString() }, backup: { pgDumpPath: exe('pg_dump'), pgRestorePath: exe('pg_restore') } };
    const dumpResult = await backupPostgresDatabase({ config, dumpPath: dump, runCommand });
    assert.equal(dumpResult.ok, true, JSON.stringify(dumpResult));
    const restoredUrl = new URL(migrationUrl); restoredUrl.pathname = '/restored_probe';
    const restoreResult = await restorePostgresDatabase({ config: { ...config, database: { url: restoredUrl.toString() } }, dumpPath: dump, runCommand });
    assert.equal(restoreResult.ok, true, JSON.stringify(restoreResult));
    assert.equal((await runPackageMigrations({ projectRoot: root, databaseUrl: restoredUrl.toString(), operation: 'status', output: { log() {} } })).ok, true);
    assert.deepEqual((await restoreTarget.query('SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name')).rows, (await database.query('SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name')).rows);
    assert.equal((await restoreTarget.query("SELECT count(*)::int AS count FROM employees WHERE last_name='Runtime'")).rows[0].count, 1);
    assert.deepEqual((await restoreTarget.query('SELECT * FROM warehouse_issues ORDER BY id')).rows, warehouseIssuesBeforeBackup);
    assert.deepEqual((await restoreTarget.query('SELECT * FROM warehouse_issue_positions ORDER BY id')).rows, warehousePositionsBeforeBackup);
    await assert.rejects(restoreTarget.query('UPDATE warehouse_issue_positions SET quantity=0'), { code: '23514' });
    await assert.rejects(restoreTarget.query('DELETE FROM warehouse_balances'), { code: '23503' });
    assert.equal((await restoreTarget.query('SELECT app_search_normalize($1) AS text', ['Ёж  СИЗ'])).rows[0].text, 'еж сиз');
    const historicalSearch = (await database.query('SELECT app_search_normalize($1) AS text', ['Ёж  СИЗ'])).rows[0].text;
    assert.equal(historicalSearch, 'еж сиз');
    await environment.adminQuery("CREATE DATABASE unsupported_locale TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER libc LOCALE 'C'");
    await assert.rejects(runPackageMigrations({ projectRoot: root, databaseUrl: environment.urlFor('unsupported_locale'), operation: 'deploy', output: { log() {} } }), /Unsupported database encoding\/locale/);
    // Failure diagnostics from the original prototype now run against real packages.
    const brokenId = '20261018000000_core_failure_probe';
    const brokenSql = 'CREATE TABLE failure_probe(id integer); SELECT * FROM missing_failure_probe;';
    const coreManifestPath = join(root, 'backend/prisma/packages/core/manifest.json');
    const coreManifest = JSON.parse(await readFile(coreManifestPath, 'utf8'));
    await mkdir(join(root, 'backend/prisma/packages/core/migrations', brokenId));
    await writeFile(join(root, 'backend/prisma/packages/core/migrations', brokenId, 'migration.sql'), brokenSql);
    coreManifest.migrations.push({ id: brokenId, sha256: createHash('sha256').update(brokenSql).digest('hex') });
    await writeFile(coreManifestPath, JSON.stringify(coreManifest));
    const broken = await cli('deploy');
    assert.equal(broken.ok, false);
    assert.match(broken.stdout + broken.stderr, /P3018/);
    const failedHistory = (await database.query('SELECT finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1', [brokenId])).rows;
    assert.deepEqual(failedHistory, [{ finished_at: null, rolled_back_at: null }]);
    // PostgreSQL/Prisma can retain DDL preceding the failure. Never assume rollback.
    const partialDdlPresent = (await database.query("SELECT to_regclass('public.failure_probe') AS name")).rows[0].name !== null;
    for (const operation of ['status', 'deploy']) {
      const blocked = await cli(operation);
      assert.equal(blocked.ok, false);
      assert.match(blocked.stderr, /Failed or incomplete migration/);
    }
    const output = join(project, '.local/modular-migrations-probe');
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'production.json'), JSON.stringify({ roles: flags, runtimePrivilegesVerified: true, dumpRestoreVerified: true, failedMigrationVerified: true, partialDdlPresent, cli: report }, null, 2) + '\n');
    console.log('Non-superuser migration and seed; CLI lock; runtime privileges; full dump/restore: passed');
  } catch (error) {
    console.log(JSON.stringify(report));
    throw error;
  } finally {
    for (const client of clients) await client.end();
    await environment.close();
  }
});
