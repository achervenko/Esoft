import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "actual counting uses a locked expected quantity and no-op creates no operation",
    async ({ prisma, admin, adjustments, upload, request, quantity }) => {
      const payload = await request();
      delete payload.type;
      delete payload.quantity;
      payload.actualQuantity = "21";
      payload.expectedQuantity = "19";
      const result = await adjustments.adjustStock(payload, admin.id);
      assert.equal(result.adjustment.type, "SURPLUS");
      assert.equal(result.adjustment.quantity, "2");
      const stale = {
        ...payload,
        requestKey: randomUUID(),
        attachments: [await upload()],
        actualQuantity: "16",
      };
      await assert.rejects(
        adjustments.adjustStock(stale, admin.id),
        code("WAREHOUSE_ADJUSTMENT_STALE_BALANCE"),
      );
      const count = await prisma.warehouseStockAdjustment.count();
      const logs = await prisma.auditLog.count();
      const noOp = {
        ...stale,
        expectedQuantity: "21",
        actualQuantity: "21",
      };
      assert.deepEqual(await adjustments.adjustStock(noOp, admin.id), {
        changed: false,
        quantity: "21",
        adjustment: null,
      });
      assert.equal(await prisma.warehouseStockAdjustment.count(), count);
      assert.equal(await prisma.auditLog.count(), logs);
      const down = {
        ...noOp,
        requestKey: randomUUID(),
        actualQuantity: "17",
      };
      assert.equal(
        (await adjustments.adjustStock(down, admin.id)).adjustment.type,
        "WRITE_OFF",
      );
      assert.equal(await quantity(), "17");
    },
    { initialQuantity: "19" },
  );
}
