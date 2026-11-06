import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "simple correction with a document is audited and replay-safe",
    async ({ prisma, admin, adjustments, request, quantity }) => {
      const payload = await request();
      delete payload.type;
      delete payload.quantity;
      Object.assign(payload, {
        actualQuantity: "0",
        expectedQuantity: "19",
      });
      const first = await adjustments.adjustStock(payload, admin.id);
      assert.equal(first.adjustment.type, "WRITE_OFF");
      assert.equal(await quantity(), "0");
      assert.deepEqual(await adjustments.adjustStock(payload, admin.id), first);
      assert.equal(await prisma.warehouseStockAdjustment.count(), 1);
      assert.ok((await prisma.auditLog.count()) > 0);
    },
    { initialQuantity: "19" },
  );
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
      assert.deepEqual(await adjustments.adjustStock(noOp, admin.id), {
        changed: false,
        quantity: "21",
        adjustment: null,
      });
      assert.equal(await quantity(), "17");
      await assert.rejects(
        adjustments.adjustStock(
          { ...noOp, reason: "Changed request" },
          admin.id,
        ),
        code("WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT"),
      );
      assert.equal(await prisma.warehouseStockAdjustment.count(), count + 1);
      assert.equal(await prisma.warehouseStockAdjustmentNoop.count(), 1);
    },
    { initialQuantity: "19" },
  );
}
