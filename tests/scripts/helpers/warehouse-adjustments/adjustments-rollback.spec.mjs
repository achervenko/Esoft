import assert from "node:assert/strict";
import { code, load } from "./adjustments-test-context.mjs";

export async function verify(run) {
  const { WarehouseStockAdjustmentsService } = load(
    "warehouse/adjustments/adjustments.service.js",
  );
  const { WarehouseStockAdjustmentCommandService } = load(
    "warehouse/adjustments/adjustment-command.service.js",
  );
  await run(
    "insufficient stock and audit failures roll back quantities, operation, file binding and logs",
    async ({
      prisma,
      admin,
      stock,
      staged,
      access,
      queries,
      documents,
      adjustments,
      request,
      quantity,
    }) => {
      const payload = await request({ quantity: "99" });
      const before = await quantity();
      const operationCount = await prisma.warehouseStockAdjustment.count();
      const logCount = await prisma.auditLog.count();
      await assert.rejects(
        adjustments.adjustStock(payload, admin.id),
        code("WAREHOUSE_STOCK_INSUFFICIENT"),
      );
      const failing = new WarehouseStockAdjustmentsService(
        new WarehouseStockAdjustmentCommandService(
          prisma,
          stock,
          staged,
          {
            async writeFieldChanges() {
              throw new Error("Injected adjustment audit failure");
            },
          },
          access,
        ),
        queries,
        documents,
      );
      await assert.rejects(
        failing.adjustStock({ ...payload, quantity: "1" }, admin.id),
        /adjustment audit failure/,
      );
      assert.equal(await quantity(), before);
      assert.equal(
        await prisma.warehouseStockAdjustment.count(),
        operationCount,
      );
      assert.equal(await prisma.auditLog.count(), logCount);
      assert.ok(
        await prisma.storageUpload.findUnique({
          where: { id: payload.attachments[0] },
        }),
      );
    },
  );
}
