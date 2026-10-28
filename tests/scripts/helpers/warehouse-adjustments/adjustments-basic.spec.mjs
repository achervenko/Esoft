import assert from "node:assert/strict";

export async function verify(run) {
  await run(
    "admin can record a physical shortage without silently reducing project reservations",
    async ({ prisma, admin, item, adjustments, request, reservation }) => {
      const result = await adjustments.adjustStock(await request(), admin.id);
      assert.equal(result.adjustment.quantityBefore, "20");
      assert.equal(result.adjustment.quantityAfter, "16");
      assert.equal(result.adjustment.itemId, item.id.toString());
      assert.equal(result.adjustment.attachments.length, 1);
      assert.equal(
        (
          await prisma.warehouseProjectReservation.findUniqueOrThrow({
            where: { id: reservation.id },
          })
        ).quantity.toString(),
        "18",
      );
      const log = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "warehouse_stock_adjustment",
          entityStringId: result.adjustment.id,
        },
      });
      const snapshot = JSON.parse(log.newValue);
      assert.equal(snapshot.shortageAfter, "2");
      assert.equal(snapshot.reserved, "18");
      assert.equal(snapshot.reason, "Inventory shortage");
      assert.equal(snapshot.attachments.length, 1);
      assert.match(snapshot.attachments[0].sha256, /^[a-f0-9]{64}$/);
      assert.equal(log.userId, admin.id);
      assert.equal(
        (await adjustments.get(result.adjustment.id, admin.id)).quantityAfter,
        "16",
      );
      const page = await adjustments.list(
        { itemId: item.id.toString(), type: "WRITE_OFF", limit: "1" },
        admin.id,
      );
      assert.equal(page.total, 1);
      assert.equal(page.items[0].id, result.adjustment.id);
    },
  );
}
