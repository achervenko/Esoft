import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyConcurrentCoverage(
  c,
  t,
  manager,
  createOrder,
  fixture,
) {
  await t.test(
    "serializes restoration against other orders and ordinary reservations",
    async () => {
      const f = await fixture();
      const second = await createOrder(randomUUID());
      const { reservation } = await f.reserve(c.a, "2", second.id);
      await f.reduce(c.a, "2");
      await c.transaction((ctx) =>
        manager.reduceCoverage(ctx, f.command(c.a, "2", reservation.id)),
      );
      const third = await createOrder(randomUUID());
      const results = await Promise.allSettled([
        f.restore(c.b, "2"),
        f.restore(c.b, "2", reservation.id),
        f.reserve(c.b, "2", third.id),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      for (const result of results)
        if (result.status === "rejected")
          hasCode("WAREHOUSE_RESERVATION_INSUFFICIENT", 409)(result.reason);
      const { _sum } = await c.prisma.warehouseReservationAllocation.aggregate({
        where: {
          locationId: c.b.id,
          reservation: { itemId: BigInt(f.itemId) },
        },
        _sum: { quantity: true },
      });
      assert.equal(String(_sum.quantity), "2");
    },
  );

  await t.test(
    "serializes restoration and reduction against decrease and move",
    async () => {
      const f = await fixture();
      await f.reduce(c.a, "2");
      const results = await Promise.allSettled([
        f.restore(c.b, "2"),
        c.transaction((ctx) =>
          manager.decrease(ctx, {
            reservationId: f.reservation.id,
            allocations: [],
            deficitQuantity: "2",
          }),
        ),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      hasCode(
        "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT",
        409,
      )(results.find((result) => result.status === "rejected").reason);
      const restored = results[0].status === "fulfilled";
      assert.equal(
        await f.state(
          restored ? "8" : "6",
          restored
            ? [
                [c.a, "6"],
                [c.b, "2"],
              ]
            : [[c.a, "6"]],
        ),
        "0",
      );

      const moves = await Promise.allSettled([
        f.reduce(c.a, "4"),
        c.transaction((ctx) =>
          manager.move(ctx, {
            reservationId: f.reservation.id,
            fromLocationId: c.loc(c.a),
            toLocationId: c.loc(c.c),
            quantity: "4",
          }),
        ),
      ]);
      assert.equal(
        moves.filter((result) => result.status === "fulfilled").length,
        1,
      );
      hasCode(
        "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
        409,
      )(moves.find((result) => result.status === "rejected").reason);
      const reduced = moves[0].status === "fulfilled";
      const allocations = [[c.a, "2"]];
      if (restored) allocations.push([c.b, "2"]);
      if (!reduced) allocations.push([c.c, "4"]);
      assert.equal(
        await f.state(restored ? "8" : "6", allocations),
        reduced ? "4" : "0",
      );
    },
  );

  await t.test(
    "reads physical stock after a concurrent Stock write",
    async () => {
      const f = await fixture();
      await f.reduce(c.a, "2");
      let pending;
      await c.transaction(async (ctx) => {
        await c.stock.issueStock(ctx, f.itemId, c.loc(c.b), "2");
        pending = assert.rejects(
          f.restore(c.b, "2"),
          hasCode("WAREHOUSE_RESERVATION_INSUFFICIENT", 409),
        );
      });
      await pending;
      assert.equal(await f.state("8", [[c.a, "6"]]), "2");
    },
  );
}
