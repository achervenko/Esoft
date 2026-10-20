import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';
import { verifyWarehouseIssues } from '../../helpers/warehouse-issues.mjs';

const project = resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const quiet = { log() {} };

async function verifyWarehouse(prisma, database, actor) {
  const item = await prisma.warehouseItem.create({ data: { id: 9007199254740993n, article: 'WH-1', name: 'Warehouse item', unit: 'шт' } });
  assert.equal(item.id, 9007199254740993n);
  assert.equal(item.isActive, true);
  const location = await prisma.warehouseStorageLocation.create({ data: { code: 'A-1', name: 'Shelf' } });
  assert.equal(location.isActive, true);
  await prisma.warehouseStorageLocation.update({ where: { id: location.id }, data: { isActive: false } });
  assert.equal((await prisma.warehouseStorageLocation.findUniqueOrThrow({ where: { id: location.id } })).isActive, false);
  const projectRow = await prisma.warehouseProject.create({ data: { projectNumber: 'PROJECT-1' } });
  assert.equal(projectRow.name, null);
  assert.equal(projectRow.isActive, true);
  const balance = await prisma.warehouseBalance.create({ data: { itemId: item.id, storageLocationId: location.id } });
  assert.equal(balance.quantity.toString(), '0');
  await prisma.warehouseBalance.update({ where: { id: balance.id }, data: { quantity: '12345678901.123' } });
  const reservation = await prisma.warehouseProjectReservation.create({ data: { balanceId: balance.id, projectId: projectRow.id, quantity: '0.125' } });
  assert.equal(reservation.quantity.toString(), '0.125');
  await prisma.warehouseProject.update({ where: { id: projectRow.id }, data: { isActive: false } });
  const closedProject = await prisma.warehouseProject.findUniqueOrThrow({
    where: { id: projectRow.id }, include: { reservations: true },
  });
  assert.equal(closedProject.isActive, false);
  assert.equal(closedProject.reservations[0].id, reservation.id);
  assert.equal((await prisma.warehouseBalance.findUniqueOrThrow({ where: { id: balance.id } })).quantity.toString(), '12345678901.123');
  await assert.rejects(prisma.warehouseItem.create({ data: { article: item.article, name: 'Duplicate', unit: 'шт' } }), { code: 'P2002' });
  await assert.rejects(prisma.warehouseStorageLocation.create({ data: { code: location.code, name: 'Duplicate' } }), { code: 'P2002' });
  await assert.rejects(prisma.warehouseProject.create({ data: { projectNumber: projectRow.projectNumber } }), { code: 'P2002' });
  await assert.rejects(prisma.warehouseBalance.create({ data: { itemId: item.id, storageLocationId: location.id } }), { code: 'P2002' });
  await assert.rejects(prisma.warehouseProjectReservation.create({ data: { balanceId: balance.id, projectId: projectRow.id, quantity: '1' } }), { code: 'P2002' });
  await assert.rejects(prisma.warehouseBalance.create({ data: { itemId: -1n, storageLocationId: location.id } }), { code: 'P2003' });
  const sheet = await prisma.warehouseIssueSheet.create({ data: {
    name: 'Imported sheet', sourceFileName: 'sheet.xlsx', sourceFileHash: 'a'.repeat(64),
    status: 'draft', createdByUserId: actor.id, createdAt: new Date('2026-10-16T13:00:00+03:00'),
  } });
  assert.equal(sheet.processedByUserId, null);
  assert.equal(sheet.processedAt, null);
  assert.equal(sheet.createdAt.toISOString(), '2026-10-16T10:00:00.000Z');
  const line = await prisma.warehouseIssueSheetLine.create({ data: {
    issueSheetId: sheet.id, quantity: '1.125', rowNumber: 1, matchingStatus: 'unmatched',
    sourceArticle: 'Imported article', sourceName: 'Imported name', sourceLocation: 'Shelf', sourceProject: 'Project',
  } });
  assert.equal(line.itemId, null);
  assert.equal(line.storageLocationId, null);
  assert.equal(line.projectId, null);
  for (const rowNumber of [0, -1]) {
    await assert.rejects(database.query(
      'UPDATE warehouse_issue_sheet_lines SET row_number=$1 WHERE id=$2',
      [rowNumber, line.id.toString()],
    ), { code: '23514' });
    await assert.rejects(database.query(
      'INSERT INTO warehouse_issue_sheet_lines(issue_sheet_id, quantity, matching_status, row_number) VALUES ($1, 1, $2, $3)',
      [sheet.id.toString(), 'unmatched', rowNumber],
    ), { code: '23514' });
  }
  await assert.rejects(prisma.warehouseIssueSheetLine.create({ data: {
    issueSheetId: sheet.id, quantity: '2', rowNumber: 1, matchingStatus: 'unmatched',
  } }), { code: 'P2002' });
  const secondSheet = await prisma.warehouseIssueSheet.create({ data: {
    name: 'Second sheet', status: 'draft', createdByUserId: actor.id,
  } });
  const serverTime = await database.query('SELECT CURRENT_TIMESTAMP AS now');
  assert.ok(Math.abs(secondSheet.createdAt.getTime() - serverTime.rows[0].now.getTime()) < 10000);
  const otherLine = await prisma.warehouseIssueSheetLine.create({ data: {
    issueSheetId: secondSheet.id, quantity: '1', rowNumber: 1, matchingStatus: 'unmatched',
  } });
  await assert.rejects(prisma.warehouseIssueSheetLine.update({
    where: { id: otherLine.id }, data: { issueSheetId: sheet.id },
  }), { code: 'P2002' });
  await prisma.warehouseIssueSheetLine.delete({ where: { id: otherLine.id } });
  await prisma.warehouseIssueSheet.delete({ where: { id: secondSheet.id } });
  const matched = await prisma.warehouseIssueSheetLine.update({ where: { id: line.id }, data: {
    itemId: item.id, storageLocationId: location.id, projectId: projectRow.id, unitSnapshot: item.unit,
  }, include: { item: true, storageLocation: true, project: true, issueSheet: true } });
  assert.equal(matched.item.id, item.id);
  assert.equal(matched.unitSnapshot, 'шт');
  await prisma.warehouseItem.update({ where: { id: item.id }, data: { unit: 'уп' } });
  assert.equal((await prisma.warehouseIssueSheetLine.findUniqueOrThrow({ where: { id: line.id } })).unitSnapshot, 'шт');
  for (const [table, id, rejected] of [
    ['warehouse_balances', balance.id, ['-0.001']],
    ['warehouse_project_reservations', reservation.id, ['0', '-0.001']],
    ['warehouse_issue_sheet_lines', line.id, ['0', '-0.001']],
  ]) {
    for (const quantity of rejected) {
      await assert.rejects(database.query(`UPDATE "${table}" SET quantity=$1 WHERE id=$2`, [quantity, id.toString()]), { code: '23514' });
    }
  }
  await prisma.warehouseProjectReservation.delete({ where: { id: reservation.id } });
  await prisma.warehouseBalance.update({ where: { id: balance.id }, data: { quantity: '0' } });
  await assert.rejects(database.query('INSERT INTO warehouse_project_reservations(balance_id, project_id) VALUES ($1, $2)', [balance.id.toString(), projectRow.id.toString()]), { code: '23502' });
  const index = await database.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='idx_warehouse_project_reservations_project'");
  assert.match(index.rows[0].indexdef, /\(project_id\)/);
  const locationIndex = await database.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='idx_warehouse_balances_storage_location'");
  assert.match(locationIndex.rows[0].indexdef, /\(storage_location_id\)/);
  assert.equal(matched.issueSheet.id, sheet.id);
  await prisma.warehouseIssueSheet.update({ where: { id: sheet.id }, data: { processedByUserId: actor.id, processedAt: new Date('2026-10-16T11:00:00Z') } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, include: { createdWarehouseIssueSheets: true, processedWarehouseIssueSheets: true } });
  assert.equal(user.createdWarehouseIssueSheets[0].id, sheet.id);
  assert.equal(user.processedWarehouseIssueSheets[0].id, sheet.id);
  await assert.rejects(prisma.warehouseIssueSheet.update({ where: { id: sheet.id }, data: { processedByUserId: 'missing-user' } }), { code: 'P2003' });
  await assert.rejects(prisma.user.delete({ where: { id: actor.id } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseItem.delete({ where: { id: item.id } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseIssueSheet.delete({ where: { id: sheet.id } }), { code: 'P2003' });
  await verifyWarehouseIssues(prisma, database, { item, balance, line, project: projectRow });
  const columns = (await database.query("SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'warehouse_%'")).rows;
  assert.deepEqual([...new Set(columns.map((column) => column.table_name))].sort(), [
    'warehouse_items', 'warehouse_storage_locations', 'warehouse_projects', 'warehouse_balances',
    'warehouse_project_reservations', 'warehouse_issue_sheets', 'warehouse_issue_sheet_lines',
    'warehouse_issues', 'warehouse_issue_positions', 'warehouse_stock_adjustments',
    'warehouse_stock_adjustment_attachments',
  ].sort());
  for (const column of columns.filter((column) => column.column_name === 'quantity')) {
    assert.equal(column.numeric_precision, 14);
    assert.equal(column.numeric_scale, 3);
  }
  assert.equal(columns.find((column) => column.column_name === 'created_at').data_type, 'timestamp with time zone');
  assert.equal(columns.find((column) => column.column_name === 'source_file_hash').character_maximum_length, 64);
  for (const column of columns.filter((column) => column.column_name === 'id')) assert.equal(column.data_type, 'bigint');
}

test('warehouse installs independently, stays absent when disabled and can be installed later', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 240000,
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const environment = await createIsolatedPostgres();
  try {
    for (const [name, modules, fresh] of [
      ['warehouse_core', [], false],
      ['warehouse_equipment', ['equipment'], false],
      ['warehouse_ppe', ['ppe'], false],
      ['warehouse_all', ['equipment', 'ppe'], false],
      ['warehouse_fresh', ['warehouse'], true],
    ]) {
      const root = join(environment.root, name);
      await mkdir(join(root, 'backend/prisma/packages'), { recursive: true });
      await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
      for (const id of ['core', ...modules]) await cp(join(project, 'backend/prisma/packages', id), join(root, 'backend/prisma/packages', id), { recursive: true });
      const select = (selected) => writeFile(join(root, 'database-packages.json'), JSON.stringify({ modules: selected }));
      await select(modules);
      const database = await environment.database(name);
      const url = environment.urlFor(name);
      const deploy = async () => {
        const result = await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'deploy', output: quiet });
        assert.equal(result.ok, true, result.stdout + result.stderr);
      };
      await deploy();
      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
      try {
        const actor = await prisma.user.create({ data: { id: 'warehouse-user', name: 'Existing user', email: 'warehouse@test.invalid' } });
        const before = await prisma.user.findMany();
        if (!fresh) {
          assert.equal((await database.query("SELECT to_regclass('public.warehouse_items') AS name")).rows[0].name, null);
          await cp(join(project, 'backend/prisma/packages/warehouse'), join(root, 'backend/prisma/packages/warehouse'), { recursive: true });
          await select([...modules, 'warehouse']);
          await deploy();
          assert.deepEqual(await prisma.user.findMany(), before);
        }
        await verifyWarehouse(prisma, database, actor);
        const history = (await database.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows;
        await deploy();
        assert.deepEqual((await database.query('SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name')).rows, history);
        assert.equal((await prisma.warehouseIssueSheetLine.findMany()).length, 1);
        assert.equal((await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'status', output: quiet })).ok, true);
      } finally { await prisma.$disconnect(); }
    }
  } finally { await environment.close(); }
});
