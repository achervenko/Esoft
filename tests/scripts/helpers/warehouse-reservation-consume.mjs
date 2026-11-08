import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCoverageFixture } from "./warehouse-reservation-coverage-fixture.mjs";
import { hasCode } from "./warehouse-stock-test-context.mjs";
import { verifyConsumeConcurrency } from "./warehouse-reservation-consume-concurrency.mjs";

export async function verifyReservationConsume(
  c,
  t,
  Manager,
  manager,
  createOrder,
) {
  const fixture = async () => {
    const f = await createCoverageFixture(c, manager, createOrder);
    const consume = (location, quantity) =>
      c.transaction((ctx) =>
        manager.consume(ctx, f.command(location, quantity)),
      );
    const physical = async (location) =>
      (await c.read(location, f.itemId))?.quantity ?? "0";
    return { ...f, consume, physical };
  };

  await t.test(
    "consumes only the selected placement and preserves deficit, free stock and other orders",
    async () => {
      const f = await fixture();
      const { reservation: other } = await f.reserve(
        c.a,
        "2",
        (await createOrder(randomUUID())).id,
      );
      await f.reserve(c.b, "2");
      await f.reduce(c.a, "1");
      const balance = await c.read(c.a, f.itemId);
      const stockAudit = () =>
        c.prisma.auditLog.count({
          where: {
            entityType: "warehouse_balance",
            entityStringId: balance.id,
          },
        });
      const beforeAudit = await stockAudit();
      const result = await f.consume(c.a, new c.Prisma.Decimal("2.125"));
      assert.equal(result.reservation.id, f.reservation.id);
      assert.equal(result.reservation.orderId, f.order.id);
      assert.equal(String(result.reservation.itemId), f.itemId);
      assert.equal(String(result.reservation.quantity), "7.875");
      assert.equal(String(result.allocation.quantity), "4.875");
      assert.equal(String(result.deficitQuantity), "1");
      assert.equal(
        await f.state("7.875", [
          [c.a, "4.875"],
          [c.b, "2"],
        ]),
        "1",
      );
      assert.equal(await f.state("2", [[c.a, "2"]], other.id), "0");
      assert.equal(await f.physical(c.a), "7.875");
      assert.equal(await f.physical(c.b), "2");
      assert.equal(await stockAudit(), beforeAudit + 1);
      const entry = (await f.history()).at(-1);
      assert.equal(entry.entityStringId, f.reservation.id);
      assert.equal(entry.userId, c.actor.id);
      assert.equal(entry.action, "UPDATE");
      assert.equal(entry.fieldName, "quantity");
      assert.ok(entry.createdAt instanceof Date);
      assert.deepEqual(JSON.parse(entry.newValue), {
        operation: "CONSUME",
        orderId: f.order.id,
        itemId: f.itemId,
        locationId: c.loc(c.a),
        quantity: "2.125",
        before: "10",
        after: "7.875",
        allocationBefore: "7",
        allocationAfter: "4.875",
        deficitBefore: "1",
        deficitAfter: "1",
      });
      await assert.rejects(
        f.consume(c.a, "5"),
        hasCode("WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT", 409),
      );
    },
  );

  await t.test(
    "deletes exhausted placements and reuses the UUID of an exhausted reserve",
    async () => {
      const f = await fixture();
      await f.reserve(c.b, "2");
      const issueCount = await c.prisma.warehouseIssue.count();
      const positionCount = await c.prisma.warehouseIssuePosition.count();
      const first = await f.consume(c.a, "8");
      assert.equal(first.allocation, null);
      assert.equal(await f.state("2", [[c.b, "2"]]), "0");
      const final = await f.consume(c.b, "2");
      assert.equal(final.reservation.id, f.reservation.id);
      assert.equal(final.allocation, null);
      assert.equal(await f.state("0", []), "0");
      assert.equal(await f.physical(c.a), "2");
      assert.equal(await f.physical(c.b), "0");
      assert.equal(await c.prisma.warehouseIssue.count(), issueCount);
      assert.equal(
        await c.prisma.warehouseIssuePosition.count(),
        positionCount,
      );
      assert.equal(
        (await f.reserve(c.a, "1")).reservation.id,
        f.reservation.id,
      );
    },
  );

  await t.test(
    "validates identifiers, transaction context, quantities and available placement",
    async () => {
      const f = await fixture();
      const valid = f.command(c.a, "1");
      for (const [input, code, status] of [
        [{ reservationId: "bad" }, "WAREHOUSE_RESERVATION_ID_INVALID", 400],
        [
          { reservationId: randomUUID() },
          "WAREHOUSE_RESERVATION_NOT_FOUND",
          404,
        ],
        [{ locationId: "0" }, "WAREHOUSE_STOCK_ID_INVALID", 400],
        [
          { locationId: "9223372036854775807" },
          "WAREHOUSE_LOCATION_NOT_FOUND",
          404,
        ],
        [
          { locationId: c.loc(c.b) },
          "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
          409,
        ],
        ...["0", "-1", "1.0001"].map((quantity) => [
          { quantity },
          "WAREHOUSE_STOCK_QUANTITY_INVALID",
          400,
        ]),
      ]) {
        await assert.rejects(
          c.transaction((ctx) => manager.consume(ctx, { ...valid, ...input })),
          hasCode(code, status),
        );
      }
      await assert.rejects(
        manager.consume({ tx: c.prisma, actorUserId: c.actor.id }, valid),
        hasCode("WAREHOUSE_STOCK_TRANSACTION_REQUIRED", 400),
      );
      await assert.rejects(
        c.prisma.$transaction(
          (tx) => manager.consume({ tx, actorUserId: c.actor.id }, valid),
          { isolationLevel: "RepeatableRead" },
        ),
        hasCode("WAREHOUSE_RESERVATION_ISOLATION_REQUIRED", 400),
      );
      assert.equal(await f.state("8", [[c.a, "8"]]), "0");
      assert.equal(await f.physical(c.a), "10");
      assert.equal((await f.history()).length, 1);
    },
  );

  await t.test(
    "rejects physical shortages even when the requested amount alone is available",
    async () => {
      const f = await fixture();
      await f.reserve(c.a, "2", (await createOrder(randomUUID())).id);
      for (const quantity of ["9", "1"]) {
        await c.transaction(({ tx }) =>
          c.forceBalance(tx, c.a, quantity, f.itemId),
        );
        await assert.rejects(
          f.consume(c.a, "2"),
          hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
        );
      }
      assert.equal(await f.state("8", [[c.a, "8"]]), "0");
      assert.equal(await f.physical(c.a), "1");
      assert.equal((await f.history()).length, 1);
    },
  );

  await t.test(
    "rolls back on PostgreSQL errors in Stock and reservation audit writes",
    async () => {
      const f = await fixture();
      const badActor = randomUUID();
      const failingAudit = new Manager(
        {
          writeFieldChanges: (params) =>
            c.audit.writeFieldChanges({ ...params, userId: badActor }),
        },
        c.stock,
      );
      const before = await c.prisma.auditLog.count();
      const input = f.command(c.a, "8");
      await assert.rejects(
        c.transaction((ctx) =>
          manager.consume({ ...ctx, actorUserId: badActor }, input),
        ),
        { code: "P2003" },
      );
      await assert.rejects(
        c.transaction((ctx) => failingAudit.consume(ctx, input)),
        { code: "P2003" },
      );
      assert.equal(await f.state("8", [[c.a, "8"]]), "0");
      assert.equal(await f.physical(c.a), "10");
      assert.equal(await c.prisma.auditLog.count(), before);
    },
  );

  await verifyConsumeConcurrency(c, t, manager, fixture);
}
