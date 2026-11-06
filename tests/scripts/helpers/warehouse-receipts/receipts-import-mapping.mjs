import assert from "node:assert/strict";
import { code } from "../warehouse-receipts-test-context.mjs";

export async function receiptsImportMapping(c, t) {
  await t.test(
    "direct import rejects unknown and inactive warehouses before any writes or replay",
    async () => {
      const unknown = c.source({
        warehouse: { id: c.namespace + "-unknown", name: "Unknown" },
      });
      const count = await c.prisma.warehouseReceipt.count();
      await assert.rejects(
        c.ingest(unknown),
        (error) => error.code === "WAREHOUSE_UNMAPPED",
      );
      assert.equal(await c.prisma.warehouseReceipt.count(), count);
      const doc = c.source();
      const imported = await c.ingest(doc);
      const before = await c.prisma.warehouseReceipt.findUniqueOrThrow({
        where: { id: BigInt(imported.id) },
      });
      await c.prisma.warehouse.update({
        where: { id: c.warehouse.id },
        data: { isActive: false },
      });
      try {
        for (const version of ["1", "2"]) {
          await assert.rejects(
            c.ingest({ ...doc, version }),
            (error) => error.code === "WAREHOUSE_INACTIVE",
          );
        }
        await assert.rejects(
          c.ingest(c.source()),
          (error) => error.code === "WAREHOUSE_INACTIVE",
        );
        assert.deepEqual(
          await c.prisma.warehouseReceipt.findUniqueOrThrow({
            where: { id: before.id },
          }),
          before,
        );
        assert.equal(await c.prisma.warehouseReceipt.count(), count + 1);
      } finally {
        await c.prisma.warehouse.update({
          where: { id: c.warehouse.id },
          data: { isActive: true },
        });
      }
      await assert.rejects(
        c.ingest({ ...doc, warehouse: unknown.warehouse }),
        (error) => error.code === "WAREHOUSE_UNMAPPED",
      );
      assert.deepEqual(
        await c.prisma.warehouseReceipt.findUniqueOrThrow({
          where: { id: before.id },
        }),
        before,
      );
    },
  );
  await t.test(
    "preconfigured warehouse, source snapshots, unknown item mapping and line orders",
    async () => {
      const doc = c.source(),
        before = await c.quantity();
      let r = await c.ingest(doc);
      assert.equal(r.warehouseId, String(c.warehouse.id));
      assert.equal(r.lines[0].itemId, null);
      assert.equal(r.lines[0].article, null);
      assert.equal(r.lines[0].order.id, doc.lines[0].order.id);
      assert.equal(await c.quantity(), before);
      await assert.rejects(c.place(r), code("WAREHOUSE_RECEIPT_UNMAPPED"));

      await c.itemMapping.mapItem(
        r.id,
        r.lines[0].id,
        { itemId: String(c.item.id) },
        c.keeper.id,
      );
      r = await c.receipts.findOne(r.id);
      assert.equal(r.lines[0].itemId, String(c.item.id));
      assert.equal(r.lines[0].article, c.item.article);
      const next = await c.ingest(c.source());
      assert.equal(next.lines[0].itemId, String(c.item.id));
      assert.equal(next.warehouseId, String(c.warehouse.id));
      const link = await c.prisma.warehouseItemExternalLink.findUnique({
        where: {
          sourceSystem_externalId: {
            sourceSystem: c.sourceSystem,
            externalId: doc.lines[0].item.id,
          },
        },
      });
      assert.equal(link.sourceArticle, " 6204 ");
    },
  );
  await t.test(
    "source mapping can create catalog items and rolls back failed audit",
    async () => {
      const doc = c.source();
      doc.lines[0].item.id = c.namespace + "-created-item";
      let r = await c.ingest(doc);
      const payload = {
        create: {
          article: c.namespace + "-created",
          name: "New source item",
          unit: "шт",
        },
      };
      c.failAudit(true);
      try {
        await assert.rejects(
          c.itemMapping.mapItem(r.id, r.lines[0].id, payload, c.keeper.id),
          /audit failed/,
        );
      } finally {
        c.failAudit(false);
      }
      assert.equal(
        await c.prisma.warehouseItem.count({
          where: { article: payload.create.article },
        }),
        0,
      );
      await c.itemMapping.mapItem(r.id, r.lines[0].id, payload, c.keeper.id);
      r = await c.receipts.findOne(r.id);
      assert.ok(r.lines[0].itemId);
    },
  );
  await t.test(
    "Catalog creation participates in the caller transaction when mapping fails later",
    async () => {
      await assert.rejects(
        c.catalog.create(
          {
            article: c.namespace + "-no-transaction",
            name: "Invalid",
            unit: "шт",
          },
          c.keeper.id,
          c.prisma,
        ),
        code("WAREHOUSE_CATALOG_TRANSACTION_REQUIRED"),
      );
      const doc = c.source();
      doc.lines[0].item.id = c.namespace + "-catalog-rollback";
      const r = await c.ingest(doc);
      const payload = {
        create: {
          article: c.namespace + "-catalog-rollback",
          name: "Rollback",
          unit: "м",
        },
      };
      await assert.rejects(
        c.itemMapping.mapItem(r.id, r.lines[0].id, payload, c.keeper.id),
        code("WAREHOUSE_RECEIPT_UNIT_MISMATCH"),
      );
      assert.equal(
        await c.prisma.warehouseItem.count({
          where: { article: payload.create.article },
        }),
        0,
      );
      assert.equal((await c.receipts.findOne(r.id)).lines[0].itemId, null);
    },
  );
}
