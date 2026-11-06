import assert from "node:assert/strict";

export async function receiptsImportReconciliation(c, t) {
  await t.test(
    "manual-first reconciliation never adds stock again",
    async () => {
      const manual = await c.manual("4");
      await c.place(manual, "4");
      let imported = await c.mapped();
      const before = await c.quantity(),
        payload = {
          manualReceiptId: manual.id,
          lines: [
            {
              manualLineId: manual.lines[0].id,
              receiptLineId: imported.lines[0].id,
            },
          ],
        };
      await c.reconciliation.reconcile(imported.id, payload, c.keeper.id);
      await c.reconciliation.reconcile(imported.id, payload, c.keeper.id);
      assert.equal(await c.quantity(), before);
      imported = await c.receipts.findOne(imported.id);
      assert.equal(imported.lines[0].placed, "4");
      assert.equal(imported.placedQuantity, "4");
      const summary = (
        await c.queries.list({ warehouseId: String(c.warehouse.id) })
      ).items.find((row) => row.id === imported.id);
      assert.equal(summary.totalQuantity, "10");
      assert.equal(summary.placedQuantity, "4");

      assert.equal(imported.lines[0].remaining, "6");
      await c.place(imported, "6");
      assert.equal((await c.receipts.findOne(imported.id)).status, "PLACED");
    },
  );
}
