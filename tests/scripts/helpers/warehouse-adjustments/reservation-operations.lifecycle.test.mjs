import assert from "node:assert/strict";
import { load, code } from "./adjustments-test-context.mjs";
import { setup, input } from "./reservation-operations.test-context.mjs";
export async function verify(run) {
  const { WarehouseReservationsService } = load(
    "warehouse/reservations/reservations.service.js",
  );
  await run(
    "admin borrowing preserves demand, protects other projects, restores explicitly and replays safely",
    async (c) => {
      const service = setup(c),
        id = String(c.reservation.id),
        borrowed = input(c, "BORROW", "5");
      const other = await c.prisma.warehouseProject.create({
        data: { projectNumber: "OTHER" },
      });
      await c.prisma.warehouseProjectReservation.create({
        data: {
          balanceId: c.reservation.balanceId,
          projectId: other.id,
          quantity: "2",
        },
      });
      await assert.rejects(service.execute(id, borrowed, c.keeper.id));
      const first = await service.execute(id, borrowed, c.admin.id);
      assert.equal(await c.quantity(), "15");
      assert.equal(first.after, "18");
      assert.equal(first.borrowedAfter, "5");
      const { WarehouseReservationsApiService } = load(
        "warehouse/reservations/reservations-api.service.js",
      );
      const api = new WarehouseReservationsApiService(
        c.prisma,
        c.stock,
        new WarehouseReservationsService(c.audit),
        c.audit,
      );
      for (const actor of [c.keeper.id, c.admin.id]) {
        await assert.rejects(
          api.release(id, actor),
          code("WAREHOUSE_RESERVATION_ADMIN_RELEASE_REQUIRED"),
        );
        await assert.rejects(
          api.update(id, { quantity: "17" }, actor),
          code("WAREHOUSE_RESERVATION_ADMIN_RELEASE_REQUIRED"),
        );
      }
      assert.equal(
        (await api.update(id, { quantity: "18" }, c.keeper.id))
          .borrowedQuantity,
        "5",
      );

      assert.deepEqual(await service.execute(id, borrowed, c.admin.id), first);
      assert.equal(await c.quantity(), "15");
      await assert.rejects(
        service.execute(id, { ...borrowed, comment: "Different" }, c.admin.id),
        code("WAREHOUSE_RESERVATION_REQUEST_CONFLICT"),
      );
      await assert.rejects(
        service.execute(id, input(c, "BORROW", "14", "18", "5"), c.admin.id),
        code("WAREHOUSE_RESERVATION_INSUFFICIENT"),
      );
      await assert.rejects(
        service.execute(id, input(c, "RESTORE", "1", "18", "5"), c.admin.id),
        code("WAREHOUSE_RESERVATION_INSUFFICIENT"),
      );
      await c.prisma.$transaction((tx) =>
        c.stock.receiveStock(
          { tx, actorUserId: c.admin.id },
          String(c.item.id),
          String(c.location.id),
          "5",
        ),
      );
      const unchanged =
        await c.prisma.warehouseProjectReservation.findUniqueOrThrow({
          where: { id: c.reservation.id },
        });
      assert.equal(unchanged.borrowedQuantity.toString(), "5");
      await service.execute(
        id,
        input(c, "RESTORE", "5", "18", "5"),
        c.admin.id,
      );
      const restored =
        await c.prisma.warehouseProjectReservation.findUniqueOrThrow({
          where: { id: c.reservation.id },
        });
      assert.equal(restored.quantity.toString(), "18");
      assert.equal(restored.borrowedQuantity.toString(), "0");
      assert.equal(await c.quantity(), "20");
      const release = {
        ...input(c, "RELEASE", "18"),
        attachments: [(await service.upload(c.file, c.admin.id)).uploadId],
      };
      await service.execute(id, release, c.admin.id);
      assert.equal(await c.quantity(), "20");
      assert.equal(
        await c.prisma.warehouseProjectReservation.count({
          where: { id: c.reservation.id },
        }),
        0,
      );
      assert.deepEqual(
        await service.execute(id, release, c.admin.id),
        await c.prisma.warehouseReservationOperation
          .findUniqueOrThrow({
            where: {
              actorUserId_requestKey: {
                actorUserId: c.admin.id,
                requestKey: release.requestKey,
              },
            },
          })
          .then((r) => r.result),
      );
    },
  );
}
