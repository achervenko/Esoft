import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyReservationCreate(c, t, fixture) {
  const { manager, first, second, input, reserve, assertStoredTotal } = fixture;

  await t.test(
    "creates one reserve and increases existing allocations with audit",
    async () => {
      await c.receive(c.a, "10");
      await c.receive(c.b, "10");
      const initial = await reserve(input(c.a, "5.125"));
      const increased = await reserve(
        input(c.a, "1.875", first.id.toUpperCase()),
      );
      assert.equal(increased.reservation.id, initial.reservation.id);
      assert.equal(increased.allocation.id, initial.allocation.id);
      assert.equal(increased.allocation.quantity.toString(), "7");
      const elsewhere = await reserve(input(c.b, "2"));
      assert.equal(elsewhere.reservation.id, initial.reservation.id);
      assert.notEqual(elsewhere.allocation.id, initial.allocation.id);
      assert.equal(elsewhere.reservation.quantity.toString(), "9");
      const other = await reserve(input(c.a, "3", second.id));
      assert.notEqual(other.reservation.id, initial.reservation.id);
      await assertStoredTotal(initial.reservation.id, "9");
      await assertStoredTotal(other.reservation.id, "3");
      assert.equal((await c.read(c.a)).quantity, "10");
      const entries = await c.prisma.auditLog.findMany({
        where: {
          entityType: "warehouse_reservation",
          entityStringId: initial.reservation.id,
        },
        orderBy: { id: "asc" },
      });
      assert.deepEqual(
        entries.map((row) => row.action),
        ["CREATE", "UPDATE", "UPDATE"],
      );
      assert.equal(entries[1].userId, c.actor.id);
      assert.deepEqual(JSON.parse(entries[1].newValue), {
        orderId: first.id,
        itemId: c.id,
        locationId: c.loc(c.a),
        before: "5.125",
        after: "7",
        delta: "1.875",
        allocationBefore: "5.125",
        allocationAfter: "7",
      });
      await assert.rejects(
        c.prisma.warehouseReservation.create({
          data: {
            id: randomUUID(),
            orderId: first.id,
            itemId: c.item.id,
            quantity: "1",
          },
        }),
        { code: "P2002" },
      );
      await assert.rejects(
        c.prisma.warehouseReservationAllocation.create({
          data: {
            id: randomUUID(),
            reservationId: initial.reservation.id,
            locationId: c.a.id,
            quantity: "1",
          },
        }),
        { code: "P2002" },
      );
      await assert.rejects(
        c.database.query(
          "UPDATE warehouse_reservations SET quantity = -0.001 WHERE id = $1",
          [initial.reservation.id],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        c.database.query(
          "UPDATE warehouse_reservation_allocations SET quantity = -0.001 WHERE id = $1",
          [initial.allocation.id],
        ),
        { code: "23514" },
      );
      await assertStoredTotal(initial.reservation.id, "9");
    },
  );

  await t.test(
    "rejects invalid quantities, missing references and insufficient stock",
    async () => {
      const valid = input(c.a, "1");
      for (const quantity of ["0", "-1", "0.0001"])
        await assert.rejects(
          reserve({ ...valid, quantity }),
          hasCode("WAREHOUSE_STOCK_QUANTITY_INVALID"),
        );
      for (const [patch, code] of [
        [{ orderId: randomUUID() }, "WAREHOUSE_RESERVATION_ORDER_NOT_FOUND"],
        [{ itemId: "9223372036854775807" }, "WAREHOUSE_ITEM_NOT_FOUND"],
        [{ locationId: "9223372036854775807" }, "WAREHOUSE_LOCATION_NOT_FOUND"],
        [{}, "WAREHOUSE_RESERVATION_INSUFFICIENT"],
      ])
        await assert.rejects(reserve({ ...valid, ...patch }), hasCode(code));
      await assert.rejects(
        c.prisma.$transaction((tx) => manager.reserve({ tx }, valid), {
          isolationLevel: "RepeatableRead",
        }),
        hasCode("WAREHOUSE_RESERVATION_ISOLATION_REQUIRED"),
      );
    },
  );
}
