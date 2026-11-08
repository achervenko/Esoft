import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyStockReservations(c, t) {
  const { manager, first } = await createReservationFixture(c);
  const fixture = async (reserved = "8") => {
    const itemId = await c.newItem(randomUUID());
    await c.receive(c.a, "10", itemId);
    const reserve = (quantity) =>
      c.transaction((ctx) =>
        manager.reserve(ctx, {
          orderId: first.id,
          itemId,
          locationId: c.loc(c.a),
          quantity,
        }),
      );
    const { reservation } = reserved === "0" ? {} : await reserve(reserved);
    const command = (quantity) => ({
      reservationId: reservation.id,
      locationId: c.loc(c.a),
      quantity,
    });
    const available = () =>
      c.transaction(async ({ tx }) => {
        const values = await c.stock.lockAvailability(tx, itemId, c.loc(c.a));
        return [values.physical, values.reserved, values.free].map(String);
      });
    return { itemId, reserve, reservation, command, available };
  };

  await t.test(
    "ordinary issues and moves can use only free stock",
    async () => {
      const f = await fixture("6");
      assert.deepEqual(await f.available(), ["10", "6", "4"]);
      await assert.rejects(c.issue(c.a, "5", f.itemId), (error) => {
        hasCode("WAREHOUSE_STOCK_RESERVED", 409)(error);
        assert.deepEqual(error.response.details, {
          itemId: f.itemId,
          locationId: c.loc(c.a),
          physical: "10",
          reserved: "6",
          free: "4",
          requested: "5",
        });
        return true;
      });
      await assert.rejects(
        c.move(c.a, c.b, "5", f.itemId),
        hasCode("WAREHOUSE_STOCK_RESERVED", 409),
      );
      assert.equal(await c.read(c.b, f.itemId), null);
      await c.move(c.a, c.b, "3", f.itemId);
      await c.issue(c.a, "1", f.itemId);
      assert.deepEqual(await f.available(), ["6", "6", "0"]);
      assert.equal((await c.read(c.b, f.itemId)).quantity, "3");
      await assert.rejects(
        c.issue(c.a, "1", f.itemId),
        hasCode("WAREHOUSE_STOCK_RESERVED", 409),
      );
      assert.equal(
        await c.prisma.warehouseReservationAllocation.count({
          where: { reservationId: f.reservation.id, locationId: c.b.id },
        }),
        0,
      );
    },
  );

  await t.test(
    "rejects corrupt coverage and stale transaction snapshots",
    async () => {
      const f = await fixture();
      await c.transaction(({ tx }) => c.forceBalance(tx, c.a, "7", f.itemId));
      for (const operation of [
        () => c.issue(c.a, "1", f.itemId),
        () => c.move(c.a, c.b, "1", f.itemId),
      ])
        await assert.rejects(
          operation(),
          hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
        );
      await c.receive(c.b, "2", f.itemId);
      await assert.rejects(
        c.move(c.b, c.a, "1", f.itemId),
        hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
      );
      assert.deepEqual(await f.available(), ["7", "8", "0"]);
      await c.receive(c.a, "0.5", f.itemId);
      assert.deepEqual(await f.available(), ["7.5", "8", "0"]);
      await c.receive(c.a, "5", f.itemId);
      assert.deepEqual(await f.available(), ["12.5", "8", "4.5"]);
      await assert.rejects(
        c.prisma.$transaction(
          (tx) =>
            c.stock.issueStock(
              { tx, actorUserId: c.actor.id },
              f.itemId,
              c.loc(c.b),
              "1",
            ),
          { isolationLevel: "RepeatableRead" },
        ),
        hasCode("WAREHOUSE_STOCK_ISOLATION_REQUIRED", 400),
      );
    },
  );

  await t.test(
    "records an explicit shortage atomically and leaves deficit unchanged on receipt",
    async () => {
      const f = await fixture();
      const beforeAudit = await c.prisma.auditLog.count();
      const recordShortage = (actorUserId) =>
        c.transaction(async (ctx) => {
          await manager.reduceCoverage(ctx, f.command("3"));
          await c.stock.issueStock(
            { ...ctx, actorUserId },
            f.itemId,
            c.loc(c.a),
            "5",
          );
        });
      await assert.rejects(recordShortage(randomUUID()), { code: "P2003" });
      assert.deepEqual(await f.available(), ["10", "8", "2"]);
      assert.equal(await c.prisma.auditLog.count(), beforeAudit);
      await recordShortage(c.actor.id);
      assert.deepEqual(await f.available(), ["5", "5", "0"]);
      await c.receive(c.a, "4", f.itemId);
      assert.deepEqual(await f.available(), ["9", "5", "4"]);
      const reserve = await c.prisma.warehouseReservation.findUniqueOrThrow({
        where: { id: f.reservation.id },
      });
      assert.equal(String(reserve.quantity), "8");
    },
  );

  await t.test(
    "serializes free spending against reserve, restore, consume and free moves",
    async () => {
      const race = async (commands, errorCodes) => {
        const results = await Promise.allSettled(commands);
        assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1,
        );
        const failure = results.find((result) => result.status === "rejected");
        assert.equal(failure.reason.getStatus(), 409);
        assert.ok(
          errorCodes.includes(failure.reason.response.code),
          failure.reason.response.code,
        );
      };
      const f = await fixture("0");
      await race(
        [f.reserve("6"), c.issue(c.a, "6", f.itemId)],
        ["WAREHOUSE_RESERVATION_INSUFFICIENT", "WAREHOUSE_STOCK_RESERVED"],
      );
      assert.ok(
        [
          JSON.stringify(["10", "6", "4"]),
          JSON.stringify(["4", "0", "4"]),
        ].includes(JSON.stringify(await f.available())),
      );

      const g = await fixture();
      await c.transaction((ctx) => manager.reduceCoverage(ctx, g.command("3")));
      await race(
        [
          c.transaction((ctx) => manager.restoreCoverage(ctx, g.command("3"))),
          c.issue(c.a, "3", g.itemId),
        ],
        ["WAREHOUSE_RESERVATION_INSUFFICIENT", "WAREHOUSE_STOCK_RESERVED"],
      );
      assert.equal((await g.available())[2], "2");

      const h = await fixture();
      await Promise.all([
        c.transaction((ctx) => manager.consume(ctx, h.command("8"))),
        c.issue(c.a, "2", h.itemId),
      ]);
      assert.deepEqual(await h.available(), ["0", "0", "0"]);

      const i = await fixture();
      await race(
        [c.move(c.a, c.b, "2", i.itemId), c.move(c.a, c.c, "2", i.itemId)],
        ["WAREHOUSE_STOCK_RESERVED"],
      );
      assert.deepEqual(await i.available(), ["8", "8", "0"]);
    },
  );
}
