import assert from "node:assert/strict";
import { setup, input } from "./reservation-operations.test-context.mjs";
export async function verify(run) {
  await run(
    "borrow audit failure rolls back physical stock, demand and operation key",
    async (c) => {
      const broken = {
        writeFieldChanges: async () => {
          throw new Error("audit failure");
        },
      };
      const service = setup(c, broken);
      await assert.rejects(
        service.execute(
          String(c.reservation.id),
          input(c, "BORROW", "3"),
          c.admin.id,
        ),
        /audit failure/,
      );
      assert.equal(await c.quantity(), "20");
      assert.equal(await c.prisma.warehouseReservationOperation.count(), 0);
      assert.equal(
        (
          await c.prisma.warehouseProjectReservation.findUniqueOrThrow({
            where: { id: c.reservation.id },
          })
        ).borrowedQuantity.toString(),
        "0",
      );
    },
  );
  await run(
    "concurrent borrowing cannot apply twice, release clears unmet demand first, optional files bind atomically",
    async (c) => {
      const service = setup(c),
        id = String(c.reservation.id),
        uploaded = await service.upload(c.file, c.admin.id);
      const borrow = {
        ...input(c, "BORROW", "4"),
        attachments: [uploaded.uploadId],
      };
      const [a, b] = await Promise.all([
        service.execute(id, borrow, c.admin.id),
        service.execute(id, borrow, c.admin.id),
      ]);
      assert.deepEqual(a, b);
      assert.equal(await c.quantity(), "16");
      assert.equal(a.attachments.length, 1);
      assert.equal(await c.prisma.warehouseReservationOperation.count(), 1);
      await service.execute(
        id,
        {
          ...input(c, "RELEASE", "2", "18", "4"),
          attachments: [(await service.upload(c.file, c.admin.id)).uploadId],
        },
        c.admin.id,
      );
      const row = await c.prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: { id: c.reservation.id },
      });
      assert.equal(row.quantity.toString(), "16");
      assert.equal(row.borrowedQuantity.toString(), "2");
      assert.equal(await c.quantity(), "16");
    },
  );
}
