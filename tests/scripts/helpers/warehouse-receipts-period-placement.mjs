import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
import { loadReceiptPeriod } from "./warehouse-receipts-period-fixture.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function verifyReceiptPeriodPlacement(c, fixture, baseline) {
  const { a, b, history, invoice, order, receipts, run, server, warehouses } =
    fixture;
  const { first, stock, reserves } = baseline;
  assert.equal(await c.quantity(), stock);
  assert.equal(await c.prisma.warehouseReservation.count(), reserves);
  const byOrder = first.find(
    (receipt) => receipt.externalWarehouseId === warehouses[0],
  );
  const place = () =>
    c.placements.place(
      String(byOrder.id),
      String(byOrder.lines[0].id),
      c.placement(),
      c.keeper.id,
    );
  await assert.rejects(place(), code("WAREHOUSE_RECEIPT_ORDER_UNRESOLVED"));
  const {
    OrdersFlow,
  } = require("../../../backend/dist/src/orders/orders-flow.js");
  const {
    OrdersSyncService,
  } = require("../../../backend/dist/src/orders/orders-sync.service.js");
  new OrdersFlow(c.registry).onModuleInit();
  const orderSource = await c.coreSources.create(
    {
      name: "Period OData orders",
      systemType: "ONE_C",
      baseUrl: `http://127.0.0.1:${server.address().port}/ERP/odata/standard.odata/`,
      authorization: "Bearer receipt-period-test",
      flows: [
        {
          flowCode: "orders.customers",
          configVersion: 1,
          config: {},
          isActive: true,
        },
      ],
    },
    c.admin.id,
  );
  const ordersSync = new OrdersSyncService(c.prisma, c.registry);
  assert.equal(
    (await ordersSync.sync(orderSource.id, c.admin.id)).outcome,
    "SUCCESS",
  );
  const linkedOrder = await c.prisma.customerOrder.findUniqueOrThrow({
    where: { externalId: order },
  });
  assert.equal(linkedOrder.number, "canonical");
  await place();
  assert.equal(
    (await receipts()).find((receipt) => receipt.id === byOrder.id).lines[0]
      .orderId,
    linkedOrder.id,
  );
  assert.equal(await c.prisma.warehouseReservation.count(), reserves + 1);
  const placedReserve = () =>
    c.prisma.warehouseReservation.findUniqueOrThrow({
      where: {
        orderId_itemId: { orderId: linkedOrder.id, itemId: c.item.id },
      },
      include: { allocations: true },
    });
  const reserve = await placedReserve();
  assert.equal(reserve.quantity.toString(), "1");
  assert.equal(reserve.allocations[0].quantity.toString(), "1");
  assert.equal(reserve.allocations[0].locationId, c.location.id);
  assert.equal(Number(await c.quantity()), Number(stock) + 1);
  assert.equal((await run(a)).outcome, "SUCCESS");
  assert.deepEqual(await placedReserve(), reserve);
  assert.equal(Number(await c.quantity()), Number(stock) + 1);
  assert.equal((await receipts()).length, 3);
  invoice.status = "CREATED";
  await run(b);
  await assert.rejects(place(), code("WAREHOUSE_RECEIPT_BLOCKED"));
  invoice.status = "POSTED";
  await run(a);
  const versions = await history();
  assert.deepEqual(
    versions.map(({ version }) => version),
    [1n, 2n, 3n, 4n],
  );
  assert.deepEqual(versions[1].payload, versions[3].payload);
  invoice.lines[0].warehouse_id = warehouses[1];
  await run(b);
  assert.equal(
    (await receipts()).find((receipt) => receipt.id === byOrder.id).conflict,
    "SOURCE_LINES_CHANGED_AFTER_PLACEMENT",
  );
  invoice.status = "CANCELED";
  await run(a);
  assert.equal(
    (await receipts()).find((receipt) => receipt.id === byOrder.id).conflict,
    "SOURCE_CANCELLED_AFTER_PLACEMENT",
  );
  assert.deepEqual((await history()).slice(0, 4), versions);
  await assert.rejects(
    c.prisma
      .$executeRaw`DELETE FROM warehouse_invoice_snapshot_versions WHERE invoice_id=${invoice.id}::uuid`,
    /history is immutable/,
  );
  return linkedOrder;
}

export async function verifyScheduledOlderReceipt(c, t, fixture, linkedOrder) {
  const { b, invoice, payload, service, warehouses } = fixture;
  await t.test(
    "scheduled modification window imports an older invoice",
    async () => {
      const { OneCInvoiceSchedulerService } = loadReceiptPeriod(
        "one-c-invoice-scheduler.service.js",
      );
      const config = {
        enabled: true,
        initialFrom: "2026-11-18T08:00:00Z",
      };
      await c.coreSources.configureFlow(
        b.code,
        "warehouse.receipts",
        { configVersion: 1, isActive: true, config },
        c.admin.id,
      );
      const olderInvoice = {
        ...invoice,
        id: randomUUID(),
        date: "2026-10-01T09:00:00",
        status: "POSTED",
        lines: [{ ...invoice.lines[0], warehouse_id: warehouses[0] }],
      };
      payload.extra = [olderInvoice];
      payload.total = 2;
      const beforeStock = await c.quantity();
      const scheduler = new OneCInvoiceSchedulerService(c.prisma, service);
      await scheduler.run(
        b.id,
        new AbortController().signal,
        new Date("2026-11-18T12:00:00Z"),
      );
      const status = await scheduler.status(b.code, c.admin.id);
      assert.equal(status.latest.outcome, "SUCCESS");
      assert.equal(payload.query.get("dateFrom"), "2026-11-18T11:00:00");
      assert.equal(payload.query.get("dateTo"), "2026-11-18T12:00:00");
      assert.equal(
        status.latest.syncedThrough.toISOString(),
        "2026-11-18T09:00:00.000Z",
      );
      const expected = await c.prisma.warehouseReceipt.findFirstOrThrow({
        where: {
          sourceOperationId: `invoice:${olderInvoice.id}:${warehouses[0]}`,
        },
        include: { lines: true },
      });
      assert.equal(expected.warehouseId, c.warehouse.id);
      assert.equal(expected.lines[0].orderId, linkedOrder.id);
      assert.equal(await c.quantity(), beforeStock);
    },
  );
}
