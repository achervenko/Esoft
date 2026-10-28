import assert from "node:assert/strict";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "repeat and concurrent identical requests create one adjustment; changed payload conflicts",
    async ({ prisma, admin, adjustments, request, quantity }) => {
      const payload = await request({ type: "SURPLUS", quantity: "3" });
      const before = await prisma.auditLog.count();
      const [first, second] = await Promise.all([
        adjustments.adjustStock(payload, admin.id),
        adjustments.adjustStock(payload, admin.id),
      ]);
      assert.deepEqual(first, second);
      assert.equal(await quantity(), "19");
      assert.equal(await prisma.auditLog.count(), before + 2);
      await assert.rejects(
        adjustments.adjustStock({ ...payload, quantity: "4" }, admin.id),
        code("WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT"),
      );
    },
    { initialQuantity: "16" },
  );
}
