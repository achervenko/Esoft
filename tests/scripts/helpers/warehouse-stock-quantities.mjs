import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { verifyStockQuantitySnapshots } from "./warehouse-stock-quantities-concurrency.mjs";
const require = createRequire(import.meta.url);
const {
  WarehouseStockQueryService,
} = require("../../../backend/dist/src/warehouse/stock/stock-query.service.js");
const {
  WarehouseStockOverviewService,
} = require("../../../backend/dist/src/warehouse/stock/stock-overview.service.js");
const {
  WarehouseStockController,
} = require("../../../backend/dist/src/warehouse/stock/stock.controller.js");

export async function verifyStockQuantities(c, t) {
  const { manager, createOrder } = await createReservationFixture(c);
  const queries = new WarehouseStockQueryService(c.prisma);
  const overview = new WarehouseStockOverviewService(c.prisma);
  const controller = new WarehouseStockController(queries);
  const fixture = async () => {
    const itemId = await c.newItem(randomUUID());
    const order = await createOrder(randomUUID());
    await c.receive(c.a, "10", itemId);
    await c.receive(c.b, "10.25", itemId);
    const reserve = (location, quantity, orderId = order.id) =>
      c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId,
          orderId,
          locationId: c.loc(location),
          quantity,
        }),
      );
    const { reservation } = await reserve(c.a, "6");
    await reserve(c.b, "2");
    const command = (location, quantity) => ({
      reservationId: reservation.id,
      locationId: c.loc(location),
      quantity,
    });
    return { itemId, order, reservation, reserve, command };
  };
  const amounts = (row) => ({
    quantity: row.quantity ?? row.totalQuantity,
    reservedQuantity: row.reservedQuantity,
    freeQuantity: row.freeQuantity,
    reservationMismatch: row.reservationMismatch,
  });
  await t.test(
    "an unreserved or fully reserved location reports its physical and free quantities",
    async () => {
      const itemId = await c.newItem(randomUUID());
      await c.receive(c.a, "3.125", itemId);
      assert.deepEqual(
        amounts((await controller.balance(itemId, c.loc(c.a))).balance),
        {
          quantity: "3.125",
          reservedQuantity: "0",
          freeQuantity: "3.125",
          reservationMismatch: false,
        },
      );
      const order = await createOrder(randomUUID());
      await c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId,
          orderId: order.id,
          locationId: c.loc(c.a),
          quantity: "3.125",
        }),
      );
      assert.deepEqual(amounts(await controller.total(itemId)), {
        quantity: "3.125",
        reservedQuantity: "3.125",
        freeQuantity: "0",
        reservationMismatch: false,
      });
    },
  );
  await t.test(
    "all Stock reads aggregate per location and retain closed-order allocations and decimal precision",
    async () => {
      const f = await fixture();
      const closed = await createOrder(randomUUID());
      await c.prisma.customerOrder.update({
        where: { id: closed.id },
        data: { status: "Закрыт" },
      });
      await f.reserve(c.a, "2", closed.id);
      await c.transaction((ctx) =>
        manager.reduceCoverage(ctx, f.command(c.b, "1")),
      );
      const extra = await c.prisma.warehouseStorageLocation.create({
        data: {
          name: randomUUID(),
          warehouse: { create: { name: randomUUID() } },
        },
      });
      await c.receive(extra, "3", f.itemId);
      await c.transaction(({ tx }) =>
        c.forceBalance(tx, c.a, "5.125", f.itemId),
      );
      const history = await c.prisma.auditLog.count();
      const expected = {
        quantity: "15.375",
        reservedQuantity: "9",
        freeQuantity: "9.25",
        reservationMismatch: true,
      };
      const distribution = await overview.distribution(
        f.itemId,
        String(c.a.warehouseId),
      );
      assert.deepEqual(amounts(distribution), expected);
      assert.deepEqual(
        amounts(await controller.total(f.itemId, String(c.a.warehouseId))),
        expected,
      );
      assert.equal(await queries.getItemTotal(f.itemId), "18.375");
      assert.deepEqual(amounts(await controller.total(f.itemId)), {
        ...expected,
        quantity: "18.375",
        freeQuantity: "12.25",
      });
      const [group] = (
        await overview.list({
          search: (
            await c.prisma.warehouseItem.findUniqueOrThrow({
              where: { id: BigInt(f.itemId) },
            })
          ).article,
          warehouseId: String(c.a.warehouseId),
        })
      ).items;
      assert.deepEqual(amounts(group), expected);
      for (const preview of group.locationsPreview) {
        const location = distribution.locations.find(
          (row) => row.location.id === preview.location.id,
        );
        assert.deepEqual(amounts(preview), amounts(location));
      }
      const balances = await queries.getBalances({
        itemId: f.itemId,
        quantityState: "ALL",
      });
      for (const balance of balances.items) {
        const response = await controller.balance(f.itemId, balance.locationId);
        assert.deepEqual(response.balance, balance);
        assert.equal(typeof balance.quantity, "string");
        assert.equal(balance.item.id, f.itemId);
        assert.equal(Object.hasOwn(balance, "order"), false);
      }
      const a = balances.items.find((row) => row.locationId === c.loc(c.a));
      assert.deepEqual(amounts(a), {
        quantity: "5.125",
        reservedQuantity: "8",
        freeQuantity: "0",
        reservationMismatch: true,
      });
      assert.equal(await c.prisma.auditLog.count(), history);
      assert.equal(
        (
          await c.prisma.warehouseReservation.findUniqueOrThrow({
            where: { id: f.reservation.id },
          })
        ).quantity.toString(),
        "8",
      );
      const page = await queries.getBalances({
        itemId: f.itemId,
        limit: 1,
        page: 2,
        quantityState: "ALL",
      });
      assert.equal(page.total, 3);
      assert.deepEqual(page.items, balances.items.slice(1, 2));
    },
  );

  await t.test(
    "zero filters stay physical, deficits do not become stock and no balance is synthesized",
    async () => {
      const f = await fixture();
      await c.transaction((ctx) =>
        manager.reduceCoverage(ctx, f.command(c.a, "6")),
      );
      await c.issue(c.a, "10", f.itemId);
      let zero = await queries.getBalances({
        itemId: f.itemId,
        quantityState: "ZERO",
      });
      assert.deepEqual(amounts(zero.items[0]), {
        quantity: "0",
        reservedQuantity: "0",
        freeQuantity: "0",
        reservationMismatch: false,
      });
      await c.transaction(({ tx }) => c.forceBalance(tx, c.b, "0", f.itemId));
      zero = await queries.getBalances({
        itemId: f.itemId,
        quantityState: "ZERO",
      });
      const mismatch = zero.items.find((row) => row.locationId === c.loc(c.b));
      assert.deepEqual(amounts(mismatch), {
        quantity: "0",
        reservedQuantity: "2",
        freeQuantity: "0",
        reservationMismatch: true,
      });
      assert.equal(
        (
          await queries.getBalances({
            itemId: f.itemId,
            quantityState: "POSITIVE",
          })
        ).total,
        0,
      );
      const article = (
        await c.prisma.warehouseItem.findUniqueOrThrow({
          where: { id: BigInt(f.itemId) },
        })
      ).article;
      const groups = await overview.list({
        search: article,
        quantityState: "ZERO",
      });
      assert.deepEqual(amounts(groups.items[0]), {
        quantity: "0",
        reservedQuantity: "2",
        freeQuantity: "0",
        reservationMismatch: true,
      });
      assert.equal(
        (await overview.list({ search: article, quantityState: "POSITIVE" }))
          .total,
        0,
      );
      assert.equal(
        (await overview.list({ search: article, quantityState: "ALL" })).total,
        1,
      );
      const missing = await c.newItem(randomUUID());
      assert.deepEqual(await controller.total(missing), {
        itemId: missing,
        quantity: "0",
        reservedQuantity: "0",
        freeQuantity: "0",
        reservationMismatch: false,
      });
      assert.deepEqual(await controller.balance(missing, c.loc(c.a)), {
        balance: null,
      });
    },
  );

  await verifyStockQuantitySnapshots(c, t, {
    fixture,
    manager,
    WarehouseStockQueryService,
    WarehouseStockOverviewService,
  });
}
