import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function receiptsDisplay(c, t) {
  await t.test(
    "working articles are canonical while source and placement history remain immutable",
    async () => {
      const item = await c.catalog.create(
        { article: c.namespace + "-CANON", name: "Canonical", unit: "шт" },
        c.keeper.id,
      );
      const doc = c.source();
      doc.lines[0].item.id = c.namespace + "-display-external";
      doc.lines[0].item.article = "WR0NG-ARTICLE";
      let receipt = await c.ingest(doc);
      assert.equal(receipt.lines[0].article, null);
      assert.equal(receipt.lines[0].sourceArticle, "WR0NG-ARTICLE");
      await c.itemMapping.mapItem(
        receipt.id,
        receipt.lines[0].id,
        { itemId: item.id },
        c.keeper.id,
      );
      receipt = await c.receipts.findOne(receipt.id);
      assert.equal(receipt.lines[0].article, item.article);
      assert.equal((await c.ingest(doc)).lines[0].article, item.article);
      await c.place(receipt, "1");
      const corrected = c.namespace + "-CORRECTED";
      await c.catalog.update(item.id, { article: corrected }, c.keeper.id);
      receipt = await c.receipts.findOne(receipt.id);
      assert.equal(receipt.lines[0].article, corrected);
      assert.equal(receipt.lines[0].sourceArticle, "WR0NG-ARTICLE");
      assert.equal(receipt.lines[0].placements[0].item.article, item.article);
      const stored = await c.prisma.warehouseReceiptLine.findUnique({
        where: { id: BigInt(receipt.lines[0].id) },
      });
      assert.equal(stored.itemArticleSnapshot, "WR0NG-ARTICLE");
      assert.equal(
        receipt.sourceDocument.lines[0].item.article,
        "WR0NG-ARTICLE",
      );
      const other = c.source();
      other.lines[0].item.id = c.namespace + "-other-display-external";
      other.lines[0].item.article = "ANOTHER-WR0NG";
      const second = await c.ingest(other);
      await c.itemMapping.mapItem(
        second.id,
        second.lines[0].id,
        { itemId: item.id },
        c.keeper.id,
      );
      assert.equal(
        (await c.receipts.findOne(second.id)).lines[0].article,
        corrected,
      );
      const conflict = await c.ingest({
        ...doc,
        version: "2",
        lines: [{ ...doc.lines[0], quantity: "0.5" }],
      });
      assert.equal(conflict.conflict, "SOURCE_LINES_CHANGED_AFTER_PLACEMENT");
      assert.equal(conflict.lines[0].article, corrected);
    },
  );
  await t.test(
    "manual receipt replay and reads use current canonical articles even for inactive items",
    async () => {
      const item = await c.catalog.create(
        { article: c.namespace + "-MANUAL-OLD", name: "Manual", unit: "шт" },
        c.keeper.id,
      );
      const payload = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        lines: [{ itemId: item.id, quantity: "1" }],
      };
      const original = await c.receipts.createManual(payload, c.keeper.id);
      assert.equal(original.lines[0].article, item.article);
      const corrected = c.namespace + "-MANUAL-NEW";
      await c.catalog.update(item.id, { article: corrected }, c.keeper.id);
      await c.catalog.setStatus(item.id, { isActive: false }, c.keeper.id);
      assert.equal(
        (await c.receipts.findOne(original.id)).lines[0].article,
        corrected,
      );
      assert.equal(
        (await c.receipts.createManual(payload, c.keeper.id)).lines[0].article,
        corrected,
      );
      const stored = await c.prisma.warehouseReceiptLine.findUnique({
        where: { id: BigInt(original.lines[0].id) },
      });
      assert.equal(stored.itemArticleSnapshot, item.article);
    },
  );
}
