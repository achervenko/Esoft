import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyReservationMove(
  c,
  t,
  Manager,
  manager,
  createOrder,
) {
  const fixture = async (physical = "10") => {
    const tag = randomUUID();
    const itemId = await c.newItem(tag);
    const order = await createOrder(tag.slice(0, 10));
    await c.receive(c.a, physical, itemId);
    const reserve = (location, quantity, orderId = order.id) =>
      c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId,
          orderId,
          locationId: c.loc(location),
          quantity,
        }),
      );
    const { reservation } = await reserve(c.a, "6");
    const move = (from, to, quantity, service = manager) =>
      c.transaction((ctx) =>
        service.move(ctx, {
          reservationId: reservation.id,
          fromLocationId: typeof from === "string" ? from : c.loc(from),
          toLocationId: typeof to === "string" ? to : c.loc(to),
          quantity,
        }),
      );
    const read = async () => {
      const row = await c.prisma.warehouseReservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { allocations: true },
      });
      return {
        quantity: row.quantity.toString(),
        allocations: Object.fromEntries(
          row.allocations.map((r) => [
            String(r.locationId),
            String(r.quantity),
          ]),
        ),
        physical: await Promise.all(
          [c.a, c.b, c.c].map(
            async (l) => (await c.read(l, itemId))?.quantity ?? "0",
          ),
        ),
        audit: await c.prisma.auditLog.count({
          where: { entityStringId: reservation.id },
        }),
      };
    };
    return { itemId, order, reservation, reserve, move, read };
  };

  await t.test(
    "moves partial and full allocations, merges the destination and preserves deficit and other orders",
    async () => {
      const f = await fixture();
      const other = await createOrder("move-other");
      const { allocation } = await f.reserve(c.a, "4", other.id);
      await c.prisma.warehouseReservation.update({
        where: { id: f.reservation.id },
        data: { quantity: "8" },
      });
      const transfers = await c.prisma.warehouseTransfer.count();
      const part = await f.move(c.a, c.b, "2.125");
      assert.equal(part.reservation.id, f.reservation.id);
      assert.equal(part.reservation.orderId, f.order.id);
      assert.equal(part.reservation.itemId.toString(), f.itemId);
      assert.equal(part.reservation.quantity.toString(), "8");
      assert.equal(part.fromAllocation.quantity.toString(), "3.875");
      assert.equal(part.toAllocation.quantity.toString(), "2.125");
      assert.deepEqual((await f.read()).physical, ["7.875", "2.125", "0"]);
      const full = await f.move(c.a, c.b, "3.875");
      assert.equal(full.fromAllocation, null);
      assert.equal(full.toAllocation.id, part.toAllocation.id);
      assert.deepEqual(await f.read(), {
        quantity: "8",
        allocations: { [c.loc(c.b)]: "6" },
        physical: ["4", "6", "0"],
        audit: 3,
      });
      assert.deepEqual(
        await c.prisma.warehouseReservationAllocation.findUniqueOrThrow({
          where: { id: allocation.id },
        }),
        allocation,
      );
      assert.equal(await c.prisma.warehouseTransfer.count(), transfers);
      const entry = await c.prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "warehouse_reservation",
          entityStringId: f.reservation.id,
        },
        orderBy: { id: "desc" },
      });
      assert.equal(entry.userId, c.actor.id);
      assert.ok(entry.createdAt instanceof Date);
      assert.deepEqual(JSON.parse(entry.newValue), {
        operation: "MOVE",
        orderId: f.order.id,
        itemId: f.itemId,
        quantity: "3.875",
        reservationQuantity: "8",
        deficitQuantity: "2",
        from: { locationId: c.loc(c.a), before: "3.875", after: "0" },
        to: { locationId: c.loc(c.b), before: "2.125", after: "6" },
      });
    },
  );

  await t.test(
    "rejects invalid, unbacked and overflowing moves without writes",
    async () => {
      const f = await fixture();
      const absent = "9223372036854775807";
      const before = await f.read();
      for (const quantity of ["0", "-1", "1.0001", "100000000000"])
        await assert.rejects(
          f.move(c.a, c.b, quantity),
          hasCode("WAREHOUSE_STOCK_QUANTITY_INVALID", 400),
        );
      await assert.rejects(
        f.move(c.a, c.a, "1"),
        hasCode("WAREHOUSE_STOCK_SAME_LOCATION", 400),
      );
      for (const [from, to] of [
        [absent, c.b],
        [c.a, absent],
      ])
        await assert.rejects(
          f.move(from, to, "1"),
          hasCode("WAREHOUSE_LOCATION_NOT_FOUND", 404),
        );
      for (const [from, to, quantity] of [
        [c.b, c.a, "1"],
        [c.a, c.b, "7"],
      ])
        await assert.rejects(
          f.move(from, to, quantity),
          hasCode("WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT", 409),
        );
      assert.deepEqual(await f.read(), before);

      await c.receive(c.b, "99999999999.999", f.itemId);
      const full = await f.read();
      await assert.rejects(
        f.move(c.a, c.b, "1"),
        hasCode("WAREHOUSE_STOCK_QUANTITY_OVERFLOW", 409),
      );
      assert.deepEqual(await f.read(), full);
      await c.transaction(({ tx }) => c.forceBalance(tx, c.a, "5", f.itemId));
      const mismatch = await f.read();
      await assert.rejects(
        f.move(c.a, c.c, "1"),
        hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
      );
      assert.deepEqual(await f.read(), mismatch);
      await c.transaction(({ tx }) => c.forceBalance(tx, c.a, "0", f.itemId));
      await assert.rejects(
        f.move(c.a, c.c, "1"),
        hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
      );
    },
  );

  await t.test(
    "serializes competing and opposite moves of the same reserve",
    async () => {
      const f = await fixture();
      const competing = await Promise.allSettled([
        f.move(c.a, c.b, "4"),
        f.move(c.a, c.c, "4"),
      ]);
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      hasCode(
        "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
        409,
      )(competing.find((r) => r.status === "rejected").reason);
      const destination = competing[0].status === "fulfilled" ? c.b : c.c;
      await Promise.all([
        f.move(c.a, destination, "1"),
        f.move(destination, c.a, "1"),
      ]);
      const after = await f.read();
      assert.deepEqual(after.allocations, {
        [c.loc(c.a)]: "2",
        [c.loc(destination)]: "4",
      });
      assert.deepEqual(
        after.physical,
        destination === c.b ? ["6", "4", "0"] : ["6", "0", "4"],
      );
      assert.equal(after.quantity, "6");
    },
  );

  await t.test(
    "serializes against reservations and concurrent physical changes",
    async () => {
      const f = await fixture();
      await c.receive(c.b, "3", f.itemId);
      const other = await createOrder("move-race");
      const [moved, reserved] = await Promise.all([
        f.move(c.a, c.b, "4"),
        f.reserve(c.b, "3", other.id),
        c.receive(c.b, "1", f.itemId),
      ]);
      assert.equal(moved.toAllocation.quantity.toString(), "4");
      assert.equal(reserved.allocation.quantity.toString(), "3");
      assert.deepEqual((await f.read()).physical, ["6", "8", "0"]);

      const g = await fixture();
      await c.transaction(async (ctx) => {
        await c.forceBalance(ctx.tx, c.a, "5", g.itemId);
        // The move must read the reduced balance after this transaction releases its lock.
        g.pendingMove = g
          .move(c.a, c.b, "1")
          .then(
            () => assert.fail("move must reject inconsistent stock"),
            hasCode("WAREHOUSE_RESERVATION_STOCK_MISMATCH", 409),
          );
      });
      await g.pendingMove;
      assert.deepEqual((await g.read()).physical, ["5", "0", "0"]);
    },
  );

  await t.test(
    "rolls back all writes on reservation audit and Stock failures",
    async () => {
      const f = await fixture();
      const before = await f.read();
      const auditCount = await c.prisma.auditLog.count();
      const brokenAudit = {
        writeFieldChanges: async () => {
          throw new Error("reservation audit failure");
        },
      };
      await assert.rejects(
        f.move(c.a, c.b, "6", new Manager(brokenAudit, c.stock)),
        /reservation audit failure/,
      );
      assert.deepEqual(await f.read(), before);
      assert.equal(await c.prisma.auditLog.count(), auditCount);
      let writes = 0;
      const brokenStock = new c.WarehouseStockService(
        new c.WarehouseStockQueryService(c.prisma),
        {
          writeFieldChanges: async (input) => {
            await c.audit.writeFieldChanges(input);
            if (++writes === 2) throw new Error("Stock audit failure");
          },
        },
      );
      await assert.rejects(
        f.move(c.a, c.b, "6", new Manager(c.audit, brokenStock)),
        /Stock audit failure/,
      );
      assert.equal(writes, 2);
      assert.deepEqual(await f.read(), before);
      assert.equal(await c.prisma.auditLog.count(), auditCount);
    },
  );
}
