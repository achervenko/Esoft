import assert from "node:assert/strict";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyConsumeConcurrency(c, t, manager, fixture) {
  await t.test(
    "serializes competing consumption, decrease, move and coverage reduction",
    async () => {
      for (const operation of [
        "consume",
        "decrease",
        "move",
        "reduceCoverage",
      ]) {
        const f = await fixture();
        const input = f.command(c.a, "3");
        const rival = (ctx) => {
          switch (operation) {
            case "decrease":
              return manager.decrease(ctx, {
                reservationId: input.reservationId,
                allocations: [input],
                deficitQuantity: "0",
              });
            case "move":
              return manager.move(ctx, {
                reservationId: input.reservationId,
                fromLocationId: input.locationId,
                toLocationId: c.loc(c.b),
                quantity: input.quantity,
              });
            default:
              return manager[operation](ctx, input);
          }
        };
        const [consumed, competing] = await Promise.allSettled([
          f.consume(c.a, "6"),
          c.transaction(rival),
        ]);
        assert.notEqual(consumed.status, competing.status);
        const won = consumed.status === "fulfilled";
        hasCode(
          "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
          409,
        )((won ? competing : consumed).reason);
        if (won) {
          assert.equal(await f.state("2", [[c.a, "2"]]), "0");
          assert.equal(await f.physical(c.a), "4");
        } else {
          const allocations = [[c.a, "5"]];
          if (operation === "move") allocations.push([c.b, "3"]);
          const total = ["consume", "decrease"].includes(operation) ? "5" : "8";
          assert.equal(
            await f.state(total, allocations),
            operation === "reduceCoverage" ? "3" : "0",
          );
          assert.equal(
            await f.physical(c.a),
            ["consume", "move"].includes(operation) ? "7" : "10",
          );
          assert.equal(await f.physical(c.b), operation === "move" ? "5" : "2");
        }
      }
    },
  );

  await t.test("preserves concurrent reserve and restore updates", async () => {
    const f = await fixture();
    await f.reduce(c.a, "3");
    await Promise.all([
      f.consume(c.a, "5"),
      f.reserve(c.a, "2"),
      f.restore(c.a, "3"),
    ]);
    assert.equal(await f.state("5", [[c.a, "5"]]), "0");
    assert.equal(await f.physical(c.a), "5");
  });

  await t.test(
    "checks the physical quantity after a concurrent Stock decrement commits",
    async () => {
      const f = await fixture();
      let pending;
      await c.transaction(async (ctx) => {
        await c.forceBalance(ctx.tx, c.a, "7", f.itemId);
        pending = assert.rejects(
          f.consume(c.a, "1"),
          hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
        );
      });
      await pending;
      assert.equal(await f.state("8", [[c.a, "8"]]), "0");
      assert.equal(await f.physical(c.a), "7");
    },
  );
}
