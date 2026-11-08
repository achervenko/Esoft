import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyReservationConcurrency(c, t, fixture) {
  const {
    WarehouseReservationManager,
    manager,
    createOrder,
    second,
    input,
    reserve,
    assertStoredTotal,
  } = fixture;

  await t.test(
    "serializes different orders at one location and one order across locations",
    async () => {
      await c.receive(c.c, "5");
      const attempts = await Promise.allSettled([
        reserve(input(c.c, "4")),
        reserve(input(c.c, "4", second.id)),
      ]);
      assert.equal(
        attempts.filter((row) => row.status === "fulfilled").length,
        1,
      );
      hasCode("WAREHOUSE_RESERVATION_INSUFFICIENT")(
        attempts.find((row) => row.status === "rejected").reason,
      );
      const newOrder = await createOrder("3");
      const results = await Promise.all([
        reserve(input(c.b, "2", newOrder.id)),
        reserve(input(c.c, "1", newOrder.id)),
      ]);
      assert.equal(results[0].reservation.id, results[1].reservation.id);
      const row = await assertStoredTotal(results[0].reservation.id, "3");
      assert.equal(row.allocations.length, 2);
      const atLocation =
        await c.prisma.warehouseReservationAllocation.aggregate({
          where: { locationId: c.c.id, reservation: { itemId: c.item.id } },
          _sum: { quantity: true },
        });
      assert.equal(atLocation._sum.quantity.toString(), "5");
    },
  );

  await t.test(
    "observes a concurrent Stock decrement and rolls back data and audit",
    async () => {
      let startReserve;
      const ready = new Promise((resolve) => {
        startReserve = resolve;
      });
      let releaseStock;
      const release = new Promise((resolve) => {
        releaseStock = resolve;
      });
      const decrement = c.transaction(async (ctx) => {
        const [{ pid }] = await ctx.tx
          .$queryRaw`SELECT pg_backend_pid() AS pid`;
        await c.stock.issueStock(ctx, c.id, c.loc(c.b), "5");
        startReserve(pid);
        await release;
      });
      const blocker = await Promise.race([ready, decrement]);
      const attempt = assert.rejects(
        reserve(input(c.b, "2")),
        hasCode("WAREHOUSE_RESERVATION_INSUFFICIENT"),
      );
      try {
        let waiting = false;
        for (let retry = 0; retry < 100 && !waiting; retry++) {
          const { rows } = await c.database.query(
            `SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database()
                AND $1::integer = ANY(pg_blocking_pids(pid))
                AND query LIKE '%pg_advisory_xact_lock%'
            ) AS waiting`,
            [blocker],
          );
          waiting = rows[0].waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(
          waiting,
          true,
          "Reservation must wait for Stock to commit",
        );
      } finally {
        releaseStock();
        await Promise.all([decrement, attempt]);
      }

      const newOrder = await createOrder("4");
      const command = input(c.b, "1", newOrder.id);
      let rolledBackId;
      await assert.rejects(
        c.transaction(async (ctx) => {
          rolledBackId = (await manager.reserve(ctx, command)).reservation.id;
          throw new Error("caller rollback");
        }),
        /caller rollback/,
      );
      assert.equal(
        await c.prisma.auditLog.count({
          where: { entityStringId: rolledBackId },
        }),
        0,
      );
      const broken = new WarehouseReservationManager({
        writeFieldChanges: async () => {
          throw new Error("audit failure");
        },
      });
      await assert.rejects(
        c.transaction((ctx) => broken.reserve(ctx, command)),
        /audit failure/,
      );
      assert.equal(
        await c.prisma.warehouseReservation.count({
          where: { orderId: newOrder.id },
        }),
        0,
      );
      assert.equal(
        await c.prisma.warehouseReservationAllocation.count({
          where: { locationId: c.b.id },
        }),
        2,
      );
      const committed = await c.prisma.$transaction((tx) =>
        manager.reserve({ tx }, command),
      );
      assert.equal(
        (
          await c.prisma.auditLog.findFirstOrThrow({
            where: { entityStringId: committed.reservation.id },
          })
        ).userId,
        null,
      );
      await c.receive(c.b, "1");
      await assert.rejects(
        c.prisma.$transaction((tx) =>
          manager.reserve(
            { tx, actorUserId: randomUUID() },
            input(c.b, "1", newOrder.id),
          ),
        ),
        { code: "P2003" },
      );
      const unchanged = await assertStoredTotal(committed.reservation.id, "1");
      assert.equal(unchanged.allocations[0].id, committed.allocation.id);
      assert.equal(
        await c.prisma.auditLog.count({
          where: {
            entityType: "warehouse_reservation",
            entityStringId: unchanged.id,
          },
        }),
        1,
      );
    },
  );
}
