import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, '../../../..');
const hasCode = (code, status) => (error) => {
  assert.equal(error.response?.code, code);
  if (status) assert.equal(error.getStatus(), status);
  return true;
};

test('Stock works transactionally with core + warehouse, including concurrent mutations', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 180000,
}, async (t) => {
  const { PrismaClient, Prisma } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { WarehouseStockService } = require('../../../../backend/dist/src/warehouse/stock/stock.service.js');
  const { WarehouseStockQueryService } = require('../../../../backend/dist/src/warehouse/stock/stock-query.service.js');
  const { WarehouseCatalogService } = require('../../../../backend/dist/src/warehouse/catalog/catalog.service.js');
  const { AuditLogService } = require('../../../../backend/dist/src/audit/audit-log.service.js');
  const environment = await createIsolatedPostgres();
  try {
    const root = join(environment.root, 'warehouse_stock');
    await mkdir(join(root, 'backend/prisma'), { recursive: true });
    await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
    for (const id of ['core', 'warehouse'])
      await cp(join(project, 'backend/prisma/packages', id), join(root, 'backend/prisma/packages', id), { recursive: true });
    await writeFile(join(root, 'database-packages.json'), '{"modules":["warehouse"]}');
    const database = await environment.database('warehouse_stock');
    const url = environment.urlFor('warehouse_stock');
    const deployed = await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'deploy', output: { log() {} } });
    assert.equal(deployed.ok, true, deployed.stdout + deployed.stderr);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 16 }) });
    try {
      const actor = await prisma.user.create({ data: { id: 'stock-actor', name: 'Storekeeper', email: 'stock@test.invalid', role: 'storekeeper' } });
      const audit = new AuditLogService(prisma);
      const stock = new WarehouseStockService(new WarehouseStockQueryService(prisma), audit);
      const catalog = new WarehouseCatalogService(prisma, audit);
      const item = await prisma.warehouseItem.create({ data: { id: 9007199254740993n, article: 'STOCK-A', name: 'Item A', unit: 'шт' } });
      const a = await prisma.warehouseStorageLocation.create({ data: { id: 9007199254740993n, code: 'A', name: 'Shelf A' } });
      const b = await prisma.warehouseStorageLocation.create({ data: { code: 'B', name: 'Shelf B' } });
      const c = await prisma.warehouseStorageLocation.create({ data: { code: 'C', name: 'Shelf C' } });
      const id = item.id.toString();
      const loc = (row) => row.id.toString();
      const transaction = (operation) => prisma.$transaction((tx) => operation({ tx, actorUserId: actor.id }), { timeout: 20000, maxWait: 20000 });
      const receive = (location, quantity, itemId = id) => transaction((ctx) => stock.receiveStock(ctx, itemId, loc(location), quantity));
      const issue = (location, quantity, itemId = id) => transaction((ctx) => stock.issueStock(ctx, itemId, loc(location), quantity));
      const move = (from, to, quantity, itemId = id) => transaction((ctx) => stock.moveStock(ctx, itemId, loc(from), loc(to), quantity));
      const read = (location, itemId = id) => stock.getBalance(itemId, loc(location));
      const newItem = (article) => prisma.warehouseItem.create({ data: { article, name: article, unit: 'шт' } }).then((row) => row.id.toString());

      await t.test('absence differs from a stored zero and quantities/IDs stay exact', async () => {
        assert.equal(await read(a), null);
        assert.equal(await stock.getItemTotal(id), '0');
        const received = await receive(a, new Prisma.Decimal('20.125'));
        assert.equal(received.quantity, '20.125');
        assert.equal(received.itemId, id);
        assert.equal(received.locationId, loc(a));
        assert.doesNotThrow(() => JSON.stringify(received));
        assert.equal((await receive(a, '0.875')).quantity, '21');
        await issue(a, '21');
        const zero = await read(a);
        assert.equal(zero.id, received.id);
        assert.equal(zero.quantity, '0');
        assert.equal((await stock.getBalances()).items.length, 0);
        assert.equal((await stock.getBalances({ quantityState: 'ZERO' })).items[0].id, zero.id);
        assert.equal((await stock.getBalances({ quantityState: 'ALL' })).total, 1);
      });

      await t.test('reads filter combinations, stable paging and totals across locations', async () => {
        await receive(a, '20');
        await receive(b, '5');
        const second = await newItem('STOCK-B');
        await receive(c, '3.125', second);
        assert.equal(await stock.getItemTotal(id), '25');
        assert.equal((await stock.getBalances({ itemId: id })).total, 2);
        assert.equal((await stock.getBalances({ itemIds: [id, second], locationIds: [loc(b), loc(c)] })).total, 2);
        assert.equal((await stock.getBalances({ locationId: loc(a) })).items[0].itemId, id);
        assert.deepEqual((await stock.getBalances({ minQuantity: '5', maxQuantity: '20', sortBy: 'quantity', sortOrder: 'desc' })).items.map((row) => row.quantity), ['20', '5']);
        assert.equal((await stock.getBalances({ minQuantity: '100' })).total, 0);
        const all = await stock.getBalances({ sortBy: 'location', sortOrder: 'asc' });
        assert.deepEqual(all.items.map((row) => row.location.code), ['A', 'B', 'C']);
        const page = await stock.getBalances({ sortBy: 'location', page: 2, limit: 1 });
        assert.equal(page.total, 3);
        assert.deepEqual(page.items, all.items.slice(1, 2));
        assert.deepEqual((await stock.getBalances({ sortBy: 'item', sortOrder: 'desc' })).items.map((row) => row.item.article), ['STOCK-B', 'STOCK-A', 'STOCK-A']);
      });

      await t.test('movement conserves total, creates destinations and retains zero sources', async () => {
        const result = await move(a, b, '8');
        assert.equal(result.from.quantity, '12');
        assert.equal(result.to.quantity, '13');
        await move(a, c, '12');
        assert.equal((await read(a)).quantity, '0');
        assert.equal((await read(c)).quantity, '12');
        assert.equal(await stock.getItemTotal(id), '25');
      });

      await t.test('operation errors are stable and never create a destination on failure', async () => {
        await assert.rejects(issue(a, '1'), hasCode('WAREHOUSE_STOCK_INSUFFICIENT', 409));
        await assert.rejects(move(a, b, '1'), (error) => {
          assert.deepEqual(error.response.details, { itemId: id, locationId: loc(a), requested: '1', available: '0' });
          return hasCode('WAREHOUSE_STOCK_INSUFFICIENT', 409)(error);
        });
        await assert.rejects(move(b, b, '1'), hasCode('WAREHOUSE_STOCK_SAME_LOCATION', 400));
        await assert.rejects(receive(a, '1', '9223372036854775807'), hasCode('WAREHOUSE_ITEM_NOT_FOUND', 404));
        await assert.rejects(stock.getItemTotal('9223372036854775807'), hasCode('WAREHOUSE_ITEM_NOT_FOUND', 404));
        await assert.rejects(receive({ id: 9223372036854775807n }, '1'), hasCode('WAREHOUSE_LOCATION_NOT_FOUND', 404));
        const empty = await newItem('STOCK-EMPTY');
        await assert.rejects(issue(a, '1', empty), hasCode('WAREHOUSE_BALANCE_NOT_FOUND', 404));
        await assert.rejects(move(a, b, '1', empty), hasCode('WAREHOUSE_BALANCE_NOT_FOUND', 404));
        assert.equal(await read(b, empty), null);
        const large = await newItem('STOCK-MAX');
        await receive(a, '99999999999.999', large);
        await assert.rejects(receive(a, '0.001', large), hasCode('WAREHOUSE_STOCK_QUANTITY_OVERFLOW', 409));
        await receive(b, '1', large);
        await assert.rejects(move(b, a, '1', large), hasCode('WAREHOUSE_STOCK_QUANTITY_OVERFLOW', 409));
        assert.equal((await read(b, large)).quantity, '1');
        assert.equal(await stock.getItemTotal(large), '100000000000.999');
        await assert.rejects(stock.receiveStock({ tx: prisma, actorUserId: actor.id }, id, loc(a), '1'), hasCode('WAREHOUSE_STOCK_TRANSACTION_REQUIRED', 400));
      });

      await t.test('activity is a caller policy; Stock neither activates nor blocks inactive records', async () => {
        const inactive = await prisma.warehouseItem.create({ data: { article: 'STOCK-INACTIVE', name: 'Inactive', unit: 'шт', isActive: false } });
        await prisma.warehouseStorageLocation.update({ where: { id: c.id }, data: { isActive: false } });
        const inactiveId = inactive.id.toString();
        await receive(c, '2', inactiveId);
        await issue(c, '0.5', inactiveId);
        await move(c, b, '0.5', inactiveId);
        assert.equal((await read(c, inactiveId)).item.isActive, false);
        assert.equal((await read(c, inactiveId)).location.isActive, false);
        assert.equal((await stock.getBalances({ itemActive: false })).total, 2);
        assert.equal((await stock.getBalances({ itemActive: false, locationActive: true })).items[0].locationId, loc(b));
        assert.equal((await stock.getBalances({ locationActive: false })).items.every((row) => !row.location.isActive), true);
      });

      await t.test('audit and movement roll back together, including a failure after the first leg', async () => {
        const before = await stock.getBalances({ itemId: id, quantityState: 'ALL' });
        const count = await prisma.auditLog.count({ where: { entityType: 'warehouse_balance' } });
        let calls = 0;
        const failing = new WarehouseStockService(new WarehouseStockQueryService(prisma), {
          async writeFieldChanges(params) {
            if (++calls === 2) throw new Error('Injected second-leg audit failure');
            await audit.writeFieldChanges(params);
          },
        });
        await assert.rejects(transaction((ctx) => failing.moveStock(ctx, id, loc(b), loc(a), '1')), /second-leg audit failure/);
        assert.deepEqual(await stock.getBalances({ itemId: id, quantityState: 'ALL' }), before);
        assert.equal(await prisma.auditLog.count({ where: { entityType: 'warehouse_balance' } }), count);
        const fresh = await newItem('STOCK-AUDIT-ROLLBACK');
        const failingCreate = new WarehouseStockService(new WarehouseStockQueryService(prisma), {
          async writeFieldChanges() { throw new Error('Injected receipt audit failure'); },
        });
        await assert.rejects(transaction((ctx) => failingCreate.receiveStock(ctx, fresh, loc(a), '1')), /receipt audit failure/);
        assert.equal(await read(a, fresh), null);
        await assert.rejects(transaction(async (ctx) => {
          await stock.receiveStock(ctx, id, loc(a), '7');
          assert.equal((await stock.getBalance(id, loc(a), ctx.tx)).quantity, '7');
          assert.equal(await stock.getItemTotal(id, ctx.tx), '32');
          assert.equal((await stock.getBalances({ itemId: id }, ctx.tx)).total, 3);
          throw new Error('Document failure');
        }), /Document failure/);
        assert.deepEqual(await stock.getBalances({ itemId: id, quantityState: 'ALL' }), before);
        const entries = await prisma.auditLog.findMany({ where: { entityType: 'warehouse_balance' } });
        assert.ok(entries.length > 0);
        assert.ok(entries.every((row) => row.entityId === null && row.entityStringId && row.module === 'WAREHOUSE' && row.userId === actor.id));
      });

      await t.test('parallel first receipts create one row and lose no increments', async () => {
        const racing = await newItem('STOCK-RACE');
        const results = await Promise.all(Array.from({ length: 8 }, () => receive(a, '0.125', racing)));
        assert.equal(new Set(results.map((row) => row.id)).size, 1);
        assert.equal((await read(a, racing)).quantity, '1');
        assert.equal(await prisma.warehouseBalance.count({ where: { itemId: BigInt(racing) } }), 1);
        const entry = await read(a, racing);
        const logs = await prisma.auditLog.findMany({ where: { entityType: 'warehouse_balance', entityStringId: entry.id } });
        assert.equal(logs.length, 8);
      });

      await t.test('parallel issues cannot overspend and opposite moves complete without deadlock', async () => {
        const racing = await newItem('STOCK-SPEND');
        await receive(a, '5', racing);
        const attempts = await Promise.allSettled([issue(a, '4', racing), issue(a, '4', racing)]);
        assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, 1);
        hasCode('WAREHOUSE_STOCK_INSUFFICIENT', 409)(attempts.find((entry) => entry.status === 'rejected').reason);
        assert.equal((await read(a, racing)).quantity, '1');
        await receive(a, '9', racing);
        await receive(b, '10', racing);
        await Promise.all(Array.from({ length: 6 }, (_, i) => i % 2 ? move(a, b, '1', racing) : move(b, a, '1', racing)));
        assert.equal((await read(a, racing)).quantity, '10');
        assert.equal((await read(b, racing)).quantity, '10');
      });

      await t.test('caller updates reservations and Stock atomically using the public lock protocol', async () => {
        const reservedItem = await newItem('STOCK-RESERVED');
        const balance = await receive(a, '10', reservedItem);
        const projectRow = await prisma.warehouseProject.create({ data: { projectNumber: 'STOCK-PROJECT' } });
        const reservation = await prisma.warehouseProjectReservation.create({ data: { balanceId: BigInt(balance.id), projectId: projectRow.id, quantity: '8' } });
        await transaction(async (ctx) => {
          await stock.lockBalances(ctx.tx, reservedItem, [loc(a)]);
          await ctx.tx.warehouseProjectReservation.update({ where: { id: reservation.id }, data: { quantity: '3' } });
          await stock.issueStock(ctx, reservedItem, loc(a), '5');
        });
        assert.equal((await read(a, reservedItem)).quantity, '5');
        assert.equal((await prisma.warehouseProjectReservation.findUniqueOrThrow({ where: { id: reservation.id } })).quantity.toString(), '3');
      });

      await t.test('Catalog cannot change the unit while a first Stock receipt is in progress', async () => {
        const fresh = await newItem('STOCK-UNIT');
        let ready;
        let release;
        const locked = new Promise((resolve) => { ready = resolve; });
        const gate = new Promise((resolve) => { release = resolve; });
        const receiving = transaction(async (ctx) => {
          await stock.lockBalances(ctx.tx, fresh, [loc(a)]);
          ready();
          await gate;
          await stock.receiveStock(ctx, fresh, loc(a), '1');
        });
        try {
          await Promise.race([locked, receiving]);
          const updating = catalog.update(fresh, { unit: 'кг' }, actor.id);
          const assertion = assert.rejects(updating, hasCode('WAREHOUSE_UNIT_IN_USE', 409));
          let waiting = false;
          for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
            waiting = (await database.query(`SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
              AND wait_event_type = 'Lock' AND query LIKE '%warehouse_items%'
              AND query LIKE '%FOR UPDATE%'
            ) AS waiting`)).rows[0].waiting;
            if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
          }
          assert.equal(waiting, true, 'Catalog must wait even before the first balance is inserted');
          release();
          await Promise.all([receiving, assertion]);
        } finally { release(); await receiving; }
        assert.equal((await catalog.findOne(fresh)).unit, 'шт');
      });
      const optionalTables = (await database.query("SELECT to_regclass('public.equipment') AS equipment, to_regclass('public.ppe_items') AS ppe")).rows[0];
      assert.equal(optionalTables.equipment, null);
      assert.equal(optionalTables.ppe, null);
    } finally { await prisma.$disconnect(); }
  } finally { await environment.close(); }
});
