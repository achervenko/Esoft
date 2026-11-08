import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import packageTools from "../../../../scripts/database/packages.cjs";

const project = resolve(import.meta.dirname, "../../../..");
const run = promisify(execFile);

test(
  "backend runs with the selected database packages",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 300_000,
  },
  async (t) => {
    const environment = await createIsolatedPostgres();
    try {
      for (const [name, modules] of [
        ["core", []],
        ["equipment", ["equipment"]],
        ["ppe", ["ppe"]],
        ["orders", ["orders"]],
        ["warehouse", ["warehouse"]],
        ["equipment_ppe", ["equipment", "ppe"]],
        ["equipment_orders", ["equipment", "orders"]],
        ["ppe_orders", ["ppe", "orders"]],
        ["equipment_warehouse", ["equipment", "warehouse"]],
        ["ppe_warehouse", ["ppe", "warehouse"]],
        ["equipment_ppe_orders", ["equipment", "ppe", "orders"]],
        ["full", ["equipment", "ppe", "warehouse", "orders"]],
      ]) {
        await t.test(name, async () => {
          const root = join(environment.root, name);
          await mkdir(join(root, "backend/prisma"), { recursive: true });
          await mkdir(join(root, "scripts/database"), { recursive: true });
          for (const file of [
            "backend/prisma/module-catalog.json",
            "scripts/database/packages.cjs",
          ])
            await cp(join(project, file), join(root, file));
          for (const folder of ["packages", "schema"])
            await cp(
              join(project, "backend/prisma", folder),
              join(root, "backend/prisma", folder),
              { recursive: true },
            );
          await writeFile(
            join(root, "database-packages.json"),
            JSON.stringify({ modules }),
          );
          const database = await environment.database(name);
          const databaseUrl = environment.urlFor(name);
          const template = await readFile(
            join(project, ".env.example"),
            "utf8",
          );
          await writeFile(
            join(root, ".env"),
            template
              .replace(/^DATABASE_URL=.*$/m, "DATABASE_URL=" + databaseUrl)
              .replace(
                /^BETTER_AUTH_SECRET=.*$/m,
                "BETTER_AUTH_SECRET=optional-modules-test-secret-42",
              )
              .replace(
                /^MINIO_SECRET_KEY=.*$/m,
                "MINIO_SECRET_KEY=optional-modules-test-key",
              ),
          );
          const migration = await runPackageMigrations({
            projectRoot: root,
            databaseUrl,
            operation: "deploy",
            output: { log() {} },
          });
          assert.equal(migration.ok, true, migration.stdout + migration.stderr);
          const expectedMigrations =
            packageTools.readPackageSet(root).migrations;
          const history = (
            await database.query(
              "SELECT migration_name,checksum,started_at,finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY started_at,id",
            )
          ).rows;
          assert.deepEqual(
            history.map((row) => row.migration_name),
            expectedMigrations.map((row) => row.id),
          );
          assert.deepEqual(
            history.map((row) => row.checksum),
            expectedMigrations.map((row) => row.sha256),
          );
          assert.ok(history.every((row) => row.finished_at));
          await writeFile(
            join(root, "database-packages.json"),
            JSON.stringify({ modules: [...modules].reverse() }),
          );
          assert.deepEqual(
            packageTools.readPackageSet(root).migrations.map((row) => row.id),
            expectedMigrations.map((row) => row.id),
          );
          const repeated = await runPackageMigrations({
            projectRoot: root,
            databaseUrl,
            operation: "deploy",
            output: { log() {} },
          });
          assert.equal(repeated.ok, true, repeated.stderr);
          assert.deepEqual(
            (
              await database.query(
                "SELECT migration_name,checksum,started_at,finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY started_at,id",
              )
            ).rows,
            history,
          );
          await run(
            process.execPath,
            ["-e", probe, root, JSON.stringify(modules)],
            {
              cwd: project,
              timeout: 30_000,
              windowsHide: true,
            },
          ).catch((error) => assert.fail(error.stderr || error.message));
        });
      }
    } finally {
      await environment.close();
    }
  },
);

const probe = String.raw`
const assert = require('node:assert/strict');
const config = require('./scripts/config/config-core.cjs');
const originalLoad = config.loadConfig;
config.loadConfig = options => originalLoad({ ...options, projectRoot: process.argv[1] });
const expected = new Set(JSON.parse(process.argv[2]));
if (expected.has('warehouse')) expected.add('orders');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./backend/dist/src/app.module');
const get = (app, file, name) => app.get(require('./backend/dist/src/' + file)[name]);

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    await app.listen(0, '127.0.0.1');
    const appConfig = app.get(require('@nestjs/core').ApplicationConfig);
    const PermissionsGuard = require('./backend/dist/src/auth/permissions.guard').PermissionsGuard;
    const guards = appConfig.getGlobalGuards();
    assert.equal(guards.length, 1);
    assert.ok(guards[0] instanceof PermissionsGuard);
    assert.equal(appConfig.getGlobalRequestGuards().length, 0);
    const loaded = Object.keys(require.cache).map(path => path.replaceAll('\\', '/'));
    for (const [id, folders] of [
      ['equipment', ['equipment', 'equipment-events', 'equipment-progress-dashboard', 'equipment-event-extension']],
      ['ppe', ['ppe']],
      ['orders', ['orders']],
      ['warehouse', ['warehouse']],
    ]) {
      if (!expected.has(id))
        assert.ok(!loaded.some(path => folders.some(folder => path.includes('/backend/dist/src/' + folder + '/'))), id);
    }
    const url = await app.getUrl();
    for (const [id, path] of [
      ['equipment', '/api/equipment'],
      ['ppe', '/api/ppe/norms'],
      ['orders', '/api/orders'],
      ['warehouse', '/api/warehouse/items'],
    ]) {
      const response = await fetch(url + path);
      assert.equal(response.status, expected.has(id) ? 401 : 404, path);
    }
    const query = get(app, 'search/search-query.service', 'SearchQueryService');
    assert.deepEqual(await query.search({ query: 'проверка' }, 'admin'), []);
    const rebuild = get(app, 'search/search-rebuild.service', 'SearchRebuildService');
    assert.equal((await rebuild.rebuildAll()).processed, 0);
    const events = get(app, 'events/events-query.service', 'EventsQueryService');
    assert.deepEqual(await events.findAll(), []);
    const calendar = get(app, 'calendar/engine/calendar-source.resolver', 'CalendarSourceResolver');
    assert.equal(calendar.resolveProviders({ user: { role: 'admin' } }).length, expected.has('equipment') ? 2 : 1);
    const work = get(app, 'checklists/checklist-work/checklist-work-query.repository', 'ChecklistWorkQueryRepository');
    assert.equal((await work.list({ query: { limit: 10, offset: 0 }, userId: 'probe' })).total, 0);
    assert.equal(await work.loadDetailForAccess(1), null);
    const templates = get(app, 'checklists/checklist-templates/checklist-template.repository', 'ChecklistTemplateRepository');
    assert.deepEqual(await templates.loadTemplateMaintenanceSettingsUsage(1), []);
    const dictionaries = get(app, 'dictionaries-admin/dictionaries-admin.service', 'DictionariesAdminService');
    if (expected.has('equipment')) assert.deepEqual(await dictionaries.listManufacturers(), []);
    else assert.throws(() => dictionaries.listManufacturers(), { status: 404 });
    const prisma = get(app, 'prisma/prisma.service', 'PrismaService');
    const auth = app.get(require('@thallesp/nestjs-better-auth').AuthService);
    const setupAuth = get(app, 'setup/setup-auth.service', 'SetupAuthService');
    const administrator = await setupAuth.createInitialAdminUser(
      {email:'probe-admin@test.invalid', username:'probeadmin', password:'Probe-password-12345', employeeId:1},
      {id:1, first_name:'Проверка', last_name:'Администратор', middle_name:null, position:'Администратор'},
    );
    const signedIn = await auth.api.signInUsername({body:{username:'probeadmin',password:'Probe-password-12345'}});
    assert.equal(signedIn.user.id, administrator.id);
    assert.ok((await prisma.user.findUniqueOrThrow({where:{id:administrator.id}})).lastLoginAt);
    assert.ok(await prisma.session.findFirst({where:{userId:administrator.id}}));

  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
