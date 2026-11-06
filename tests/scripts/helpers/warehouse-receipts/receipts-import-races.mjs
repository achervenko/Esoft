import assert from "node:assert/strict";

export async function receiptsImportRaces(c, t) {
  await t.test(
    "import holds warehouse and mapping row locks until commit",
    async () => {
      const doc = c.source();
      await c.prisma.$transaction(
        async (tx) => {
          await c.importer.apply(tx, c.sourceSystem, doc, c.admin.id);
          for (const operation of ["disable", "delete", "remap"]) {
            await assert.rejects(
              c.prisma.$transaction(async (other) => {
                await other.$executeRawUnsafe(
                  "SET LOCAL lock_timeout = '100ms'",
                );
                if (operation === "disable")
                  await other.$executeRaw`UPDATE warehouses SET is_active=false WHERE id=${c.warehouse.id}`;
                else if (operation === "delete")
                  await other.$executeRaw`DELETE FROM warehouse_external_warehouses WHERE source_system=${c.sourceSystem} AND external_id=${doc.warehouse.id}`;
                else
                  await other.$executeRaw`UPDATE warehouse_external_warehouses SET warehouse_id=${c.foreign.id} WHERE source_system=${c.sourceSystem} AND external_id=${doc.warehouse.id}`;
              }),
              /Code: `55P03`.*lock timeout/s,
            );
          }
        },
        { timeout: 20000 },
      );
      const receipt = await c.prisma.warehouseReceipt.findFirstOrThrow({
        where: { sourceSystem: c.sourceSystem, sourceOperationId: doc.id },
      });
      assert.equal(receipt.warehouseId, c.warehouse.id);
      assert.equal(
        (
          await c.prisma.warehouse.findUniqueOrThrow({
            where: { id: c.warehouse.id },
          })
        ).isActive,
        true,
      );
    },
  );
  await t.test(
    "import versus placement preserves both stock and expected quantity",
    async () => {
      const doc = c.source();
      const r = await c.mapped(doc);
      const next = {
        ...doc,
        version: "2",
        lines: [{ ...doc.lines[0], quantity: "3" }],
      };
      const race = await Promise.allSettled([c.place(r, "5"), c.ingest(next)]);
      assert.equal(race[1].status, "fulfilled");
      const current = await c.receipts.findOne(r.id);
      if (race[0].status === "fulfilled") {
        assert.equal(current.lines[0].placed, "5");
        assert.equal(current.conflict, "SOURCE_LINES_CHANGED_AFTER_PLACEMENT");
      } else {
        assert.equal(
          race[0].reason.response.code,
          "WAREHOUSE_RECEIPT_OVERPLACEMENT",
        );
        assert.equal(current.lines[0].placed, "0");
        assert.equal(current.lines[0].quantity, "3");
      }
    },
  );
}
