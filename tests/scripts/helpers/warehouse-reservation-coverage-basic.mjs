import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyBasicCoverage(c, t, manager, createOrder, fixture) {
  await t.test(
    "releases coverage despite physical shortage and restores it on new and existing placements",
    async () => {
      const f = await fixture();
      const other = await createOrder(randomUUID());
      const { reservation: otherReserve } = await f.reserve(c.a, "2", other.id);
      const partial = await c.transaction(async (ctx) => {
        await c.forceBalance(ctx.tx, c.a, "7", f.itemId);
        return manager.reduceCoverage(ctx, f.command(c.a, "3"));
      });
      assert.equal(partial.allocation.quantity.toString(), "5");
      assert.equal(partial.deficitQuantity.toString(), "3");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "7");
      const full = await f.reduce(c.a, "5");
      assert.equal(full.allocation, null);
      assert.equal(full.deficitQuantity.toString(), "8");
      const created = await f.restore(c.b, "2");
      assert.equal(created.reservation.id, f.reservation.id);
      assert.equal(created.reservation.orderId, f.order.id);
      assert.equal(String(created.reservation.itemId), f.itemId);
      assert.equal(created.deficitQuantity.toString(), "6");
      await c.receive(c.b, "1", f.itemId);
      const increased = await f.restore(c.b, "1");
      assert.equal(increased.allocation.id, created.allocation.id);
      assert.equal(increased.allocation.quantity.toString(), "3");
      const closed = await f.restore(c.a, "5");
      assert.equal(closed.deficitQuantity.toString(), "0");
      assert.equal(
        await f.state("8", [
          [c.a, "5"],
          [c.b, "3"],
        ]),
        "0",
      );
      assert.equal(await f.state("2", [[c.a, "2"]], otherReserve.id), "0");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "7");
      assert.equal((await c.read(c.b, f.itemId)).quantity, "3");
      const [, reduction, , restoration] = await f.history();
      for (const [
        entry,
        operation,
        location,
        quantity,
        allocationBefore,
        allocationAfter,
        deficitBefore,
        deficitAfter,
      ] of [
        [reduction, "REDUCE_COVERAGE", c.a, "3", "8", "5", "0", "3"],
        [restoration, "RESTORE_COVERAGE", c.b, "2", "0", "2", "8", "6"],
      ]) {
        assert.equal(entry.userId, c.actor.id);
        assert.ok(entry.createdAt instanceof Date);
        assert.equal(entry.action, "UPDATE");
        assert.deepEqual(JSON.parse(entry.newValue), {
          operation,
          orderId: f.order.id,
          itemId: f.itemId,
          locationId: c.loc(location),
          quantity,
          reservationQuantity: "8",
          allocationBefore,
          allocationAfter,
          deficitBefore,
          deficitAfter,
        });
      }
    },
  );

  await t.test(
    "rejects invalid quantities, over-reduction, over-restoration and fully allocated stock",
    async () => {
      const f = await fixture();
      const other = await createOrder(randomUUID());
      await f.reserve(c.b, "2", other.id);
      for (const quantity of ["0", "-1", "1.0001"]) {
        await assert.rejects(
          f.reduce(c.a, quantity),
          hasCode("WAREHOUSE_STOCK_QUANTITY_INVALID", 400),
        );
        await assert.rejects(
          f.restore(c.a, quantity),
          hasCode("WAREHOUSE_STOCK_QUANTITY_INVALID", 400),
        );
      }
      await assert.rejects(
        f.reduce(c.a, "9"),
        hasCode("WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT", 409),
      );
      await assert.rejects(
        f.reduce(c.b, "1"),
        hasCode("WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT", 409),
      );
      await f.reduce(c.a, "2");
      await assert.rejects(
        f.restore(c.a, "3"),
        hasCode("WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT", 409),
      );
      await assert.rejects(
        f.restore(c.b, "1"),
        hasCode("WAREHOUSE_RESERVATION_INSUFFICIENT", 409),
      );
      assert.equal(await f.state("8", [[c.a, "6"]]), "2");
      assert.equal((await f.history()).length, 2);
    },
  );
}

export async function verifyCoverageRollback(c, t, Manager, fixture) {
  await t.test(
    "rolls back placement changes and a Stock correction when coverage audit fails",
    async () => {
      const f = await fixture();
      const broken = new Manager(
        {
          writeFieldChanges: async () => {
            throw new Error("coverage audit failure");
          },
        },
        c.stock,
      );
      await assert.rejects(
        c.transaction(async (ctx) => {
          await c.stock.issueStock(ctx, f.itemId, c.loc(c.a), "2");
          await broken.reduceCoverage(ctx, f.command(c.a, "8"));
        }),
        /coverage audit failure/,
      );
      assert.equal((await c.read(c.a, f.itemId)).quantity, "10");
      assert.equal(await f.state("8", [[c.a, "8"]]), "0");
      await f.reduce(c.a, "2");
      await assert.rejects(
        c.transaction((ctx) =>
          broken.restoreCoverage(ctx, f.command(c.b, "2")),
        ),
        /coverage audit failure/,
      );
      assert.equal(await f.state("8", [[c.a, "6"]]), "2");
      assert.equal((await f.history()).length, 2);
    },
  );
}
