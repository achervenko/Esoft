import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { startReservationHttp } from "./warehouse-reservation-http-context.mjs";

export async function createReceiptOrderFixture(c) {
  const { manager, createOrder } = await createReservationFixture(c);
  const http = await startReservationHttp(c);
  const make = async () => {
    const itemId = await c.newItem(randomUUID());
    const order = await createOrder(randomUUID());
    const create = async (
      quantity = "5",
      orderId = order.id,
      warehouse = c.a.warehouseId,
      extra = {},
    ) =>
      http.request(
        "POST",
        "/api/warehouse/receipts",
        201,
        {
          warehouseId: String(warehouse),
          requestKey: randomUUID(),
          lines: [{ itemId, quantity, ...(orderId ? { orderId } : {}) }],
          ...extra,
        },
        "keeper",
      );
    const place = (
      receipt,
      quantity = "5",
      allocation,
      location = c.a,
      key = randomUUID(),
      expected = 201,
      role = "keeper",
    ) =>
      http.request(
        "POST",
        "/api/warehouse/receipts/" +
          receipt.id +
          "/lines/" +
          receipt.lines[0].id +
          "/placements",
        expected === null ? undefined : expected,
        {
          requestKey: key,
          storageLocationId: c.loc(location),
          quantity,
          ...(allocation ? { reservationAllocation: allocation } : {}),
        },
        role,
      );
    const seed = async (quantity = "10", deficit = "4") => {
      await c.receive(c.a, quantity, itemId);
      const result = await c.transaction((ctx) =>
        manager.reserve(ctx, {
          orderId: order.id,
          itemId,
          locationId: c.loc(c.a),
          quantity,
        }),
      );
      if (deficit !== "0")
        await c.transaction((ctx) =>
          manager.reduceCoverage(ctx, {
            reservationId: result.reservation.id,
            locationId: c.loc(c.a),
            quantity: deficit,
          }),
        );
      return result.reservation.id;
    };
    const state = async () => {
      const reservation = await c.prisma.warehouseReservation.findUnique({
        where: {
          orderId_itemId: { orderId: order.id, itemId: BigInt(itemId) },
        },
        include: { allocations: { orderBy: { locationId: "asc" } } },
      });
      const allocated =
        reservation?.allocations.reduce(
          (sum, row) => sum.plus(row.quantity),
          new c.Prisma.Decimal(0),
        ) ?? new c.Prisma.Decimal(0);
      return {
        id: reservation?.id ?? null,
        quantity: reservation?.quantity.toString() ?? "0",
        covered: allocated.toString(),
        deficit: reservation
          ? reservation.quantity.minus(allocated).toString()
          : "0",
        balances: await c.prisma.warehouseBalance.findMany({
          where: { itemId: BigInt(itemId) },
          orderBy: { storageLocationId: "asc" },
        }),
        placements: await c.prisma.warehouseReceiptPlacement.count({
          where: { receiptLine: { itemId: BigInt(itemId) } },
        }),
        audit: await c.prisma.auditLog.count(),
      };
    };
    const assertAmounts = async (quantity, covered, deficit) => {
      const result = await state();
      assert.equal(result.quantity, quantity);
      assert.equal(result.covered, covered);
      assert.equal(result.deficit, deficit);
      assert.ok(new c.Prisma.Decimal(covered).lte(quantity));
      return result;
    };
    return { itemId, order, create, place, seed, state, assertAmounts };
  };
  return { ...http, make, manager, createOrder };
}
