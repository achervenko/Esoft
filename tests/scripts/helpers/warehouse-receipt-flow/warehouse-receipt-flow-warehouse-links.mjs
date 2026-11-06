import assert from "node:assert/strict";
export async function verifyWarehouseLinks(context, t) {
  const { warehouse, warehouseLinks, source, admin, coreSource } = context;
  await t.test(
    "administrative warehouse links are authorized, source-scoped and atomic with audit",
    async () => {
      const body = {
        externalId: context.document.warehouse.id,
        warehouseId: String(warehouse.warehouse.id),
      };
      await assert.rejects(
        warehouseLinks.save(source.code, body, warehouse.keeper.id),
        (error) => error.getStatus() === 403,
      );
      warehouse.failAudit(true);
      try {
        await assert.rejects(
          warehouseLinks.save(source.code, body, admin.id),
          /audit failed/,
        );
      } finally {
        warehouse.failAudit(false);
      }
      assert.equal(
        (await warehouseLinks.list(source.code, admin.id)).links.length,
        0,
      );
      await warehouseLinks.save(source.code, body, admin.id);
      await warehouseLinks.save(source.code, body, admin.id);
      const listed = await warehouseLinks.list(source.code, admin.id);
      assert.equal(listed.links.length, 1);
      assert.equal(listed.links[0].warehouseId, body.warehouseId);
      await assert.rejects(
        warehouseLinks.save(
          source.code,
          { ...body, warehouseId: String(warehouse.foreign.id) },
          admin.id,
        ),
        (error) => error.getStatus() === 409,
      );
      assert.equal(
        (await warehouseLinks.list(coreSource.code, admin.id)).links.length,
        0,
      );
    },
  );
}
