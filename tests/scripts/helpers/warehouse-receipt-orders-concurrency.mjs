import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyReceiptOrderConcurrency(c, t, { make, manager }) {
  await t.test(
    "competing arrivals do not silently reassign a restoration whose deficit disappeared",
    async () => {
      const f = await make();
      await f.seed();
      const receipts = await Promise.all([f.create("4"), f.create("4")]);
      const results = await Promise.all(
        receipts.map((receipt) =>
          f.place(
            receipt,
            "4",
            { restoreQuantity: "4", increaseQuantity: "0" },
            c.a,
            randomUUID(),
            null,
          ),
        ),
      );
      assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
      assert.equal(
        results.find((row) => row.status === 409).result.code,
        "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT",
      );
      await f.assertAmounts("10", "10", "0");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "14");
      assert.equal((await f.state()).placements, 1);
    },
  );

  await t.test(
    "receipt placement serializes with all existing reservation and physical mutations",
    async () => {
      for (const operation of [
        "reserve",
        "decrease",
        "reduce",
        "restore",
        "consume",
        "move",
        "issue",
        "stockMove",
        "receive",
      ]) {
        const f = await make();
        const reservationId = await f.seed();
        const receipt = await f.create("2");
        const commands = {
          reserve: (ctx) =>
            manager.reserve(ctx, {
              orderId: f.order.id,
              itemId: f.itemId,
              locationId: c.loc(c.a),
              quantity: "1",
            }),
          decrease: (ctx) =>
            manager.decrease(ctx, {
              reservationId,
              allocations: [{ locationId: c.loc(c.a), quantity: "1" }],
              deficitQuantity: "0",
            }),
          reduce: (ctx) =>
            manager.reduceCoverage(ctx, {
              reservationId,
              locationId: c.loc(c.a),
              quantity: "1",
            }),
          restore: (ctx) =>
            manager.restoreCoverage(ctx, {
              reservationId,
              locationId: c.loc(c.a),
              quantity: "1",
            }),
          consume: (ctx) =>
            manager.consume(ctx, {
              reservationId,
              locationId: c.loc(c.a),
              quantity: "1",
            }),
          move: (ctx) =>
            manager.move(ctx, {
              reservationId,
              fromLocationId: c.loc(c.a),
              toLocationId: c.loc(c.b),
              quantity: "1",
            }),
          issue: (ctx) => c.stock.issueStock(ctx, f.itemId, c.loc(c.a), "1"),
          stockMove: (ctx) =>
            c.stock.moveStock(ctx, f.itemId, c.loc(c.a), c.loc(c.b), "1"),
          receive: (ctx) =>
            c.stock.receiveStock(ctx, f.itemId, c.loc(c.a), "1"),
        };
        await Promise.all([
          f.place(receipt, "2", {
            restoreQuantity: "0",
            increaseQuantity: "2",
          }),
          c.transaction(commands[operation]),
        ]);
        const result = await f.state();
        const expectedTotal = ["decrease", "consume"].includes(operation)
          ? "11"
          : operation === "reserve"
            ? "13"
            : "12";
        const expectedDeficit =
          operation === "restore" ? "3" : operation === "reduce" ? "5" : "4";
        assert.equal(result.quantity, expectedTotal, operation);
        assert.equal(result.deficit, expectedDeficit, operation);
        assert.equal(result.placements, 1);
        for (const balance of result.balances) {
          const { _sum } =
            await c.prisma.warehouseReservationAllocation.aggregate({
              where: {
                locationId: balance.storageLocationId,
                reservation: { itemId: balance.itemId },
              },
              _sum: { quantity: true },
            });
          assert.ok(balance.quantity.gte(_sum.quantity ?? 0), operation);
        }
      }
    },
  );

  await t.test(
    "a concurrent restore between preview and placement cannot change the selected allocation",
    async () => {
      const f = await make();
      const reservationId = await f.seed();
      const receipt = await f.create("4");
      let attempt;
      await c.transaction(async (ctx) => {
        await manager.restoreCoverage(ctx, {
          reservationId,
          locationId: c.loc(c.a),
          quantity: "3",
        });
        attempt = f.place(
          receipt,
          "4",
          { restoreQuantity: "4", increaseQuantity: "0" },
          c.a,
          randomUUID(),
          409,
        );
      });
      const error = await attempt;
      assert.equal(error.code, "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT");
      await f.assertAmounts("10", "9", "1");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "10");
      assert.equal((await f.state()).placements, 0);
    },
  );
}
