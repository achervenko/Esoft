import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyReservationDecrease(c, t, manager, createOrder) {
  const fixture = async (withDeficit = false) => {
    const order = await createOrder(randomUUID());
    const itemId = await c.newItem(randomUUID());
    for (const location of [c.a, c.b]) await c.receive(location, "20", itemId);
    const reserve = (location, quantity) =>
      c.transaction((ctx) =>
        manager.reserve(ctx, {
          orderId: order.id,
          itemId,
          locationId: c.loc(location),
          quantity,
        }),
      );
    const { reservation } = await reserve(c.a, "5");
    const { id } = reservation;
    await reserve(c.b, "3");
    // Seed a valid deficit directly. Its business origin belongs to a later stage.
    if (withDeficit)
      await c.prisma.warehouseReservation.update({
        where: { id },
        data: { quantity: "10" },
      });
    const part = (location, quantity) => ({
      locationId: c.loc(location),
      quantity,
    });
    const command = (allocations, deficitQuantity = "0") => ({
      reservationId: id,
      allocations,
      deficitQuantity,
    });
    const decrease = (allocations, deficitQuantity) =>
      c.transaction((ctx) =>
        manager.decrease(ctx, command(allocations, deficitQuantity)),
      );
    const state = async (total, allocations, deficit = "0") => {
      const row = await c.prisma.warehouseReservation.findUniqueOrThrow({
        where: { id },
        include: { allocations: { orderBy: { locationId: "asc" } } },
      });
      assert.equal(row.quantity.toString(), total);
      assert.deepEqual(
        Object.fromEntries(
          row.allocations.map((a) => [
            String(a.locationId),
            a.quantity.toString(),
          ]),
        ),
        Object.fromEntries(allocations.map((a) => [a.locationId, a.quantity])),
      );
      const allocated = row.allocations.reduce(
        (sum, a) => sum.plus(a.quantity),
        new c.Prisma.Decimal(0),
      );
      assert.equal(row.quantity.minus(allocated).toString(), deficit);
      for (const location of [c.a, c.b])
        assert.equal((await c.read(location, itemId)).quantity, "20");
    };
    const history = () =>
      c.prisma.auditLog.findMany({
        where: { entityType: "warehouse_reservation", entityStringId: id },
        orderBy: { id: "asc" },
      });
    return {
      order,
      itemId,
      id,
      reserve,
      part,
      command,
      decrease,
      state,
      history,
    };
  };

  await t.test(
    "reduces allocations, deletes empty ones and reuses the released UUID",
    async () => {
      const f = await fixture();
      await f.decrease([f.part(c.a, "2")]);
      await f.state("6", [f.part(c.a, "3"), f.part(c.b, "3")]);
      await f.decrease([f.part(c.a, "3")]);
      await f.state("3", [f.part(c.b, "3")]);
      const result = await f.decrease([f.part(c.b, "3")]);
      assert.equal(result.reservation.id, f.id);
      assert.equal(result.deficitQuantity.toString(), "0");
      await f.state("0", []);
      const release = (await f.history()).at(-1);
      assert.equal(release.userId, c.actor.id);
      assert.ok(release.createdAt instanceof Date);
      assert.deepEqual(JSON.parse(release.newValue), {
        operation: "RELEASE",
        orderId: f.order.id,
        itemId: f.itemId,
        before: "3",
        after: "0",
        delta: "-3",
        deficitBefore: "0",
        deficitAfter: "0",
        allocations: [{ locationId: c.loc(c.b), before: "3", after: "0" }],
      });
      assert.equal((await f.reserve(c.b, "20")).reservation.id, f.id);
      await f.state("20", [f.part(c.b, "20")]);
    },
  );

  await t.test(
    "decreases deficit alone and combines it with multiple allocations",
    async () => {
      const f = await fixture(true);
      await f.decrease([], "0.5");
      await f.state("9.5", [f.part(c.a, "5"), f.part(c.b, "3")], "1.5");
      const result = await f.decrease(
        [f.part(c.b, "1"), f.part(c.a, "2")],
        "0.5",
      );
      assert.equal(result.deficitQuantity.toString(), "1");
      await f.state("6", [f.part(c.a, "3"), f.part(c.b, "2")], "1");
      const log = JSON.parse((await f.history()).at(-1).newValue);
      assert.equal(log.operation, "DECREASE");
      assert.equal(log.deficitBefore, "1.5");
      assert.equal(log.deficitAfter, "1");
      assert.equal(log.delta, "-3.5");
      assert.equal(log.allocations.length, 2);
      await f.decrease([f.part(c.a, "3"), f.part(c.b, "2")], "1");
      await f.state("0", []);
    },
  );

  await t.test(
    "rejects invalid commands and rolls back a failed audit on PostgreSQL",
    async () => {
      const f = await fixture(true);
      const { part, decrease } = f;
      for (const [parts, deficit, code] of [
        [[], "0", "WAREHOUSE_STOCK_QUANTITY_INVALID"],
        [[], "-1", "WAREHOUSE_STOCK_QUANTITY_INVALID"],
        [[part(c.a, "0.0001")], "0", "WAREHOUSE_STOCK_QUANTITY_INVALID"],
        [[part(c.a, "-1")], "0", "WAREHOUSE_STOCK_QUANTITY_INVALID"],
        [
          [part(c.a, "1"), part(c.a, "1")],
          "0",
          "WAREHOUSE_RESERVATION_DUPLICATE_LOCATION",
        ],
        [
          [part(c.a, "1"), part(c.b, "4")],
          "0",
          "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
        ],
        [
          [part(c.c, "1")],
          "0",
          "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
        ],
        [
          [part({ id: "9223372036854775807" }, "1")],
          "0",
          "WAREHOUSE_LOCATION_NOT_FOUND",
        ],
        [
          [part(c.a, "1")],
          "2.001",
          "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT",
        ],
      ])
        await assert.rejects(decrease(parts, deficit), hasCode(code));
      const command = f.command([part(c.a, "5"), part(c.b, "1")], "1");
      await assert.rejects(
        c.transaction((ctx) =>
          manager.decrease(ctx, { ...command, reservationId: randomUUID() }),
        ),
        hasCode("WAREHOUSE_RESERVATION_NOT_FOUND"),
      );
      await assert.rejects(
        c.prisma.$transaction((tx) => manager.decrease({ tx }, command), {
          isolationLevel: "RepeatableRead",
        }),
        hasCode("WAREHOUSE_RESERVATION_ISOLATION_REQUIRED"),
      );
      await assert.rejects(
        c.transaction((ctx) =>
          manager.decrease({ ...ctx, actorUserId: randomUUID() }, command),
        ),
        { code: "P2003" },
      );
      await f.state("10", [part(c.a, "5"), part(c.b, "3")], "2");
      assert.equal((await f.history()).length, 2);
    },
  );

  await t.test(
    "serializes increases and decreases and rejects a competing over-release",
    async () => {
      const f = await fixture(true);
      const { part, decrease } = f;
      await Promise.all([
        f.reserve(c.b, "2"),
        decrease([part(c.b, "1"), part(c.a, "1")], "1"),
      ]);
      await f.state("9", [part(c.a, "4"), part(c.b, "4")], "1");
      const competing = await Promise.allSettled([
        decrease([part(c.a, "3"), part(c.b, "3")], "1"),
        decrease([part(c.b, "3"), part(c.a, "3")], "1"),
      ]);
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      hasCode("WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT")(
        competing.find((r) => r.status === "rejected").reason,
      );
      await f.state("2", [part(c.a, "1"), part(c.b, "1")]);
      const deficitOnly = await fixture(true);
      const attempts = await Promise.allSettled([
        deficitOnly.decrease([], "2"),
        deficitOnly.decrease([], "2"),
      ]);
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      hasCode("WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT")(
        attempts.find((r) => r.status === "rejected").reason,
      );
      await deficitOnly.state("8", [part(c.a, "5"), part(c.b, "3")]);
    },
  );
}
