import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMoveApiBasic(
  c,
  t,
  { request, admin, manager, transfers, createOrder, fixture },
) {
  await t.test(
    "moves a selected reserve across warehouses, snapshots history and replays exactly once",
    async () => {
      const f = await fixture();
      const other = await f.reserve("4", (await createOrder(randomUUID())).id);
      await c.transaction((ctx) =>
        manager.reduceCoverage(ctx, {
          reservationId: f.reservation.id,
          locationId: c.loc(c.a),
          quantity: "1",
        }),
      );
      const target = await c.prisma.warehouseStorageLocation.create({
        data: {
          name: "Reserved target",
          warehouse: { create: { name: randomUUID() } },
        },
      });
      const command = { ...f.command, toLocationId: c.loc(target) };
      const result = await f.move(command);
      assert.equal(result.reservation.quantity, "8");
      assert.equal(result.reservation.deficitQuantity, "1");
      assert.equal(result.transfer.reservationId, f.reservation.id);
      assert.equal(result.transfer.comment, "Перенос резерва");
      assert.equal(result.transfer.snapshot.order.id, f.order.id);
      assert.equal(result.transfer.snapshot.order.number, f.order.number);
      assert.equal(result.transfer.snapshot.fromQuantityAfter, "9");
      assert.equal(result.transfer.snapshot.toQuantityAfter, "3");
      const beforeReplay = await f.state();
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(f.itemId) },
        data: { name: "Renamed", isActive: false },
      });
      await c.prisma.customerOrder.update({
        where: { id: f.order.id },
        data: { number: "Changed number" },
      });
      await c.prisma.warehouseStorageLocation.update({
        where: { id: target.id },
        data: { name: "Renamed target", isActive: false },
      });
      assert.deepEqual(
        await f.move({
          ...command,
          quantity: "3.000",
          comment: "Перенос резерва",
        }),
        result,
      );
      assert.equal((await f.state()).audit, beforeReplay.audit);
      const expectedTransfer = {
        ...result.transfer,
        createdAt: new Date(result.transfer.createdAt),
      };
      delete expectedTransfer.reservationId;
      assert.deepEqual(
        await transfers.findOne(result.transfer.id),
        expectedTransfer,
      );
      const history = await request(
        "GET",
        "/" + f.reservation.id + "/history",
        200,
      );
      assert.equal(history.items[0].operation, "MOVE");
      assert.equal(history.items[0].details.comment, "Перенос резерва");
      assert.equal(
        String(
          (
            await c.prisma.warehouseReservationAllocation.findUniqueOrThrow({
              where: { id: other.allocation.id },
            })
          ).quantity,
        ),
        "4",
      );
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(f.itemId) },
        data: { isActive: true },
      });
      await c.prisma.warehouseStorageLocation.update({
        where: { id: target.id },
        data: { isActive: true },
      });
      const full = await f.move({
        ...command,
        requestKey: randomUUID(),
        quantity: "4",
      });
      assert.deepEqual(
        full.reservation.allocations.map((a) => a.quantity),
        ["7"],
      );
      assert.equal(
        full.reservation.allocations[0].location.id,
        String(target.id),
      );
      assert.equal(full.reservation.deficitQuantity, "1");
      await f.move({ ...command, quantity: "2" }, 409);
      const conflict = await request(
        "POST",
        "/" + other.reservation.id + "/move",
        409,
        command,
      );
      assert.equal(conflict.code, "WAREHOUSE_TRANSFER_REQUEST_CONFLICT");
      const ordinary = { ...command, itemId: f.itemId };
      await assert.rejects(
        transfers.create(ordinary, admin.id),
        (error) =>
          error.response.code === "WAREHOUSE_TRANSFER_REQUEST_CONFLICT",
      );
    },
  );
}
