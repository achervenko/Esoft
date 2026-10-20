import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { verifyEmployeeSizeApi } from '../../helpers/employee-size-api.mjs';
import { verifySqlPackageBehavior } from '../../helpers/sql-package-behavior.mjs';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';

const project = resolve(import.meta.dirname, '../../../..');
const quiet = { log() {} };
const require = createRequire(import.meta.url);

async function snapshot(client) {
  const queries = {
    relations: `SELECT c.relname,c.relkind,obj_description(c.oid,'pg_class') AS comment FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','S') AND c.relname <> '_prisma_migrations' ORDER BY c.relname`,
    columns: `SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) AS default,obj_description(c.oid,'pg_class') AS table_comment,col_description(c.oid,a.attnum) AS comment FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p','v') AND c.relname <> '_prisma_migrations' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attname`,
    constraints: `SELECT c.relname,k.conname,k.contype,k.condeferrable,k.condeferred,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname <> '_prisma_migrations' ORDER BY c.relname,k.conname`,
    indexes: `SELECT c.relname,i.relname AS name,pg_get_indexdef(x.indexrelid) AS definition,x.indisvalid,x.indisunique FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname <> '_prisma_migrations' ORDER BY i.relname`,
    triggers: `SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
    functions: `SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition,obj_description(p.oid,'pg_proc') AS comment FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,arguments`,
    views: `SELECT c.relname,pg_get_viewdef(c.oid) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' ORDER BY c.relname`,
    enums: `SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
    sequences: `SELECT sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`,
    sequenceOwners: `SELECT c.relname AS sequence,t.relname AS table,a.attname AS column FROM pg_depend d JOIN pg_class c ON c.oid=d.objid AND c.relkind='S' JOIN pg_class t ON t.oid=d.refobjid JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND d.deptype IN ('a','i') ORDER BY c.relname`,
    collations: `SELECT to_jsonb(c)-'oid'-'collnamespace'-'collowner' AS definition FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='public' ORDER BY c.collname`,
    extensions: `SELECT extname,extversion FROM pg_extension ORDER BY extname`,
  };
  const result = {};
  for (const [key, sql] of Object.entries(queries)) {
    result[key] = (await client.query(sql)).rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([name, value]) => [name, typeof value === 'string' ? value.replaceAll('\r\n', '\n') : value]),
    ));
  }
  return result;
}

test('current packages support optional modules and late installation without data loss', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 240000,
}, async () => {
  const environment = await createIsolatedPostgres();
  const reports = [];
  try {
    let completeClient;
    let completeSnapshot;

    async function workspace(name, modules) {
      const root = join(environment.root, name);
      await mkdir(join(root, 'backend/prisma'), { recursive: true });
      await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
      for (const id of ['core', ...modules]) await cp(join(project, 'backend/prisma/packages', id), join(root, 'backend/prisma/packages', id), { recursive: true });
      await writeFile(join(root, 'database-packages.json'), JSON.stringify({ modules }));
      const client = await environment.database(name);
      return { root, client, url: environment.urlFor(name) };
    }
    async function deploy(work) {
      const result = await runPackageMigrations({ projectRoot: work.root, databaseUrl: work.url, operation: 'deploy', output: quiet });
      assert.equal(result.ok, true, result.stderr || result.stdout);
      return result;
    }
    for (const [name, modules] of [['core_only', []], ['equipment_only', ['equipment']], ['ppe_only', ['ppe']], ['complete', ['equipment', 'ppe']]]) {
      const work = await workspace(name, modules);
      const initialStatus = await runPackageMigrations({ projectRoot: work.root, databaseUrl: work.url, operation: 'status', output: quiet });
      assert.equal(initialStatus.code, 1);
      assert.match(initialStatus.stdout + initialStatus.stderr, /have not yet been applied/);
      await deploy(work);
      const tables = (await work.client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename);
      assert.equal(tables.includes('equipment'), modules.includes('equipment'));
      assert.equal(tables.includes('ppe_issues'), modules.includes('ppe'));
      const columns = (await work.client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='employees'")).rows.map((row) => row.column_name);
      for (const name of ['clothing_size', 'clothing_height', 'tshirt_size', 'tshirt_height', 'shoe_size', 'glove_size', 'headwear_size']) assert.equal(columns.includes(name), false);
      assert.equal(tables.includes('ppe_employee_sizes'), modules.includes('ppe'));
      const current = await snapshot(work.client);
      if (name === 'complete') {
        completeClient = work.client;
        completeSnapshot = current;
      }
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { seedSelectedDatabase } = require('../../../../backend/dist/prisma/seed/seed-selected.js');
      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: work.url }) });
      try {
        await seedSelectedDatabase(prisma, ['core', ...modules].map((id) => ({ id })));
        // Default scalar selection must work without PPE: no explicit select.
        const position = await prisma.position.findFirstOrThrow();
        const coreEmployee = await prisma.employee.create({ data: { firstName: 'Core', lastName: 'CRUD', positionId: position.id } });
        assert.ok((await prisma.employee.findMany()).some((employee) => employee.id === coreEmployee.id));
        assert.equal((await prisma.employee.findUnique({ where: { id: coreEmployee.id } })).firstName, 'Core');
        assert.equal((await prisma.employee.findUniqueOrThrow({ where: { id: coreEmployee.id } })).lastName, 'CRUD');
        const renamed = await prisma.employee.update({ where: { id: coreEmployee.id }, data: { firstName: 'Updated' } });
        assert.equal(renamed.firstName, 'Updated');
        for (const key of ['clothingSize', 'clothingHeight', 'tshirtSize', 'tshirtHeight', 'shoeSize', 'gloveSize', 'headwearSize']) assert.equal(Object.hasOwn(renamed, key), false);
        assert.equal(Object.hasOwn(renamed, 'ppeSizes'), false);
        if (modules.includes('ppe')) {
          await prisma.ppeEmployeeSizes.create({ data: { employeeId: coreEmployee.id, shoeSize: 42.5 } });
          assert.equal((await prisma.employee.findUnique({ where: { id: coreEmployee.id }, include: { ppeSizes: true } })).ppeSizes.shoeSize.toNumber(), 42.5);
        }
        await prisma.employee.delete({ where: { id: coreEmployee.id } });
        if (modules.includes('ppe')) assert.equal(await prisma.ppeEmployeeSizes.findUnique({ where: { employeeId: coreEmployee.id } }), null);
        if (modules.includes('ppe')) {
          await verifyEmployeeSizeApi(prisma);
          const { loadJournalPage } = require('../../../../backend/dist/src/ppe/ppe-journal-query.js');
          for (const sort of ['employee', 'actual', 'size']) {
            const page = await loadJournalPage(prisma, { sort });
            assert.equal(page.total, 0);
          }
        }
        const positions = await prisma.position.count();
        assert.ok(positions > 0);
        if (modules.includes('equipment')) assert.equal(await prisma.equipmentEventType.count(), 4);
        await seedSelectedDatabase(prisma, ['core', ...modules].map((id) => ({ id })));
        assert.equal(await prisma.position.count(), positions);
      } finally { await prisma.$disconnect(); }
      await verifySqlPackageBehavior(work.client, modules);
      const before = (await work.client.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows;
      await deploy(work);
      assert.deepEqual((await work.client.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows, before);
      if (name === 'complete') {
        await writeFile(join(work.root, 'database-packages.json'), JSON.stringify({ modules: ['equipment'] }));
        await assert.rejects(deploy(work), /Applied migration package\/file missing/);
        await writeFile(join(work.root, 'database-packages.json'), JSON.stringify({ modules }));
        const sqlPath = join(work.root, 'backend/prisma/packages/ppe/migrations/20260725000002_ppe_init/migration.sql');
        const original = await readFile(sqlPath);
        await writeFile(sqlPath, Buffer.concat([original, Buffer.from('\n-- invalid edit\n')]));
        await assert.rejects(deploy(work), /checksum mismatch/);
        await writeFile(sqlPath, original);
        await work.client.query("SELECT pg_advisory_lock(hashtext('esoft-package-migrations'), hashtext(current_database()))");
        try { await assert.rejects(deploy(work), /Another Esoft database migration/); }
        finally { await work.client.query("SELECT pg_advisory_unlock(hashtext('esoft-package-migrations'), hashtext(current_database()))"); }
        assert.deepEqual((await work.client.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows, before);
      }
      reports.push({ name, tables: tables.length, objects: Object.fromEntries(Object.entries(current).map(([key, values]) => [key, values.length])) });
    }

    const coreUpdateSql = 'CREATE TABLE core_update_probe(id integer PRIMARY KEY); INSERT INTO core_update_probe VALUES (1);';
    assert.ok(completeClient);
    await completeClient.query(coreUpdateSql);
    const expectedAfterCoreUpdate = await snapshot(completeClient);
    for (const [name, first, late] of [['late_ppe', 'equipment', 'ppe'], ['late_equipment', 'ppe', 'equipment']]) {
      const work = await workspace(name, [first]);
      await deploy(work);
      await work.client.query("INSERT INTO positions(name) VALUES ('Test position'); INSERT INTO employees(last_name,first_name,position_id) VALUES ('Existing','Employee',1)");
      const before = (await work.client.query('SELECT id,last_name,first_name,position_id FROM employees')).rows;
      if (first === 'equipment') {
        await work.client.query(`INSERT INTO workshops(name) VALUES ('Existing workshop');
          INSERT INTO sections(workshop_id,name) VALUES (1,'Existing section');
          INSERT INTO manufacturers(name) VALUES ('Existing manufacturer');
          INSERT INTO equipment_models(manufacturer_id,name) VALUES (1,'Existing model');
          INSERT INTO equipment(visible_id,inventory_number,name,model_id,issue_date,section_id,responsible_employee_id) VALUES (77,'existing-77','Existing equipment',1,'2026-01-01',1,1)`);
      } else {
        await work.client.query(`INSERT INTO "user"(id,name,email,"updatedAt") VALUES ('existing-actor','Existing actor','existing@test.invalid',now());
          INSERT INTO ppe_items(type,article,name,unit) VALUES ('OTHER','existing-item','Existing item','шт');
          INSERT INTO ppe_issues(employee_id,employee_name_snapshot,position_id,position_name_snapshot,issue_type,ppe_item_id,ppe_item_type_snapshot,ppe_article_snapshot,ppe_name_snapshot,ppe_unit_snapshot,quantity,issued_at,issued_by_user_id,issued_by_name_snapshot)
          VALUES (1,'Existing employee',1,'Test position','EXTRA',1,'OTHER','existing-item','Existing item','шт',1,'2026-01-01','existing-actor','Existing actor')`);
      }
      const sourceTable = first === 'equipment' ? 'equipment' : 'ppe_issues';
      const existingModuleRows = (await work.client.query(`SELECT * FROM ${sourceTable} ORDER BY id`)).rows;
      // A module init older than an already applied core update must still install.
      const updateId = '20261016000000_core_revision_probe';
      const manifestPath = join(work.root, 'backend/prisma/packages/core/manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      await mkdir(join(work.root, 'backend/prisma/packages/core/migrations', updateId));
      await writeFile(join(work.root, 'backend/prisma/packages/core/migrations', updateId, 'migration.sql'), coreUpdateSql);
      manifest.migrations.push({ id: updateId, sha256: createHash('sha256').update(coreUpdateSql).digest('hex') });
      await writeFile(manifestPath, JSON.stringify(manifest));
      await deploy(work);
      assert.equal((await work.client.query('SELECT id FROM core_update_probe')).rows[0].id, 1);
      await cp(join(project, 'backend/prisma/packages', late), join(work.root, 'backend/prisma/packages', late), { recursive: true });
      await writeFile(join(work.root, 'database-packages.json'), JSON.stringify({ modules: [first, late] }));
      const pending = await runPackageMigrations({ projectRoot: work.root, databaseUrl: work.url, operation: 'status', output: quiet });
      assert.equal(pending.code, 1);
      await deploy(work);
      assert.deepEqual((await work.client.query('SELECT id,last_name,first_name,position_id FROM employees')).rows, before);
      assert.deepEqual((await work.client.query(`SELECT * FROM ${sourceTable} ORDER BY id`)).rows, existingModuleRows);
      assert.deepEqual(await snapshot(work.client), expectedAfterCoreUpdate);
      if (first === 'equipment') {
        const next = await work.client.query("INSERT INTO equipment(inventory_number,name,model_id,issue_date,section_id,responsible_employee_id) VALUES ('new-after-module','New equipment',1,'2026-01-01',1,1) RETURNING visible_id");
        assert.equal(next.rows[0].visible_id, 78);
      } else {
        assert.match(existingModuleRows[0].journal_search_text, /выдано/);
      }
      assert.equal((await work.client.query("INSERT INTO positions(name) VALUES ('Next position') RETURNING id")).rows[0].id, 2);
      assert.equal((await runPackageMigrations({ projectRoot: work.root, databaseUrl: work.url, operation: 'status', output: quiet })).ok, true);
      const moduleUpdateId = `20261017000000_${late}_revision_probe`;
      const moduleUpdateSql = `CREATE TABLE ${late}_update_probe(id integer PRIMARY KEY); INSERT INTO ${late}_update_probe VALUES (1);`;
      const moduleManifestPath = join(work.root, `backend/prisma/packages/${late}/manifest.json`);
      const moduleManifest = JSON.parse(await readFile(moduleManifestPath, 'utf8'));
      await mkdir(join(work.root, `backend/prisma/packages/${late}/migrations`, moduleUpdateId));
      await writeFile(join(work.root, `backend/prisma/packages/${late}/migrations`, moduleUpdateId, 'migration.sql'), moduleUpdateSql);
      moduleManifest.migrations.push({ id: moduleUpdateId, sha256: createHash('sha256').update(moduleUpdateSql).digest('hex') });
      await writeFile(moduleManifestPath, JSON.stringify(moduleManifest));
      await deploy(work);
      assert.equal((await work.client.query(`SELECT id FROM ${late}_update_probe`)).rows[0].id, 1);
      const historyBeforeRepeat = (await work.client.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows;
      await deploy(work);
      assert.deepEqual((await work.client.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows, historyBeforeRepeat);
      reports.push({ name, equivalentToFullInstallationPlusCoreUpdate: true, existingModuleRowsPreserved: true, lateInitAfterCoreUpdate: true, moduleUpdateVerified: true });
    }
    const output = join(project, '.local/modular-migrations-probe');
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'package-scenarios.json'), JSON.stringify({ fullInstallationObjects: Object.fromEntries(Object.entries(completeSnapshot).map(([key, values]) => [key, values.length])), scenarios: reports }, null, 2) + '\n');
    console.log(JSON.stringify(reports));
  } finally { await environment.close(); }
});
