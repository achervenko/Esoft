import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  await t.test(
    "lists own links and only shared UUIDs observed by the current source",
    async () => {
      const { prisma } = context;
      const shared = randomUUID();
      const foreign = randomUUID();
      const own = randomUUID();
      const legacy = "foreign-case-sensitive-key";
      const ownLegacy = "Own-Case-Sensitive-Key";
      const warehouseId = String(warehouse.warehouse.id);
      await warehouseLinks.save(
        source.code,
        { externalId: own, warehouseId },
        admin.id,
      );
      await warehouseLinks.save(
        coreSource.code,
        { externalId: foreign, warehouseId },
        admin.id,
      );
      await warehouseLinks.save(
        coreSource.code,
        { externalId: legacy, warehouseId },
        admin.id,
      );
      await prisma.warehouseExternalWarehouse.create({
        data: {
          externalId: shared.toUpperCase(),
          sourceSystem: coreSource.code,
          warehouseId: BigInt(warehouseId),
          confirmedBy: admin.id,
        },
      });
      await warehouseLinks.save(
        source.code,
        { externalId: ownLegacy, warehouseId },
        admin.id,
      );
      const now = new Date();
      const observe = (sourceId, ids) =>
        prisma.warehouseInvoiceSnapshot.create({
          data: {
            sourceId,
            invoiceId: randomUUID(),
            observedAt: now,
            receivedAt: now,
            payloadHash: "0".repeat(64),
            version: 1n,
            payload: {
              lines: ids.map((id) => ({
                warehouse: { id, name: id },
                item: { type: "Товар" },
              })),
            },
          },
        });
      await observe(source.id, [shared, legacy]);
      await observe(coreSource.id, [foreign]);
      const { links, observed } = await warehouseLinks.list(
        source.code,
        admin.id,
      );
      assert.ok(observed.some(({ externalId }) => externalId === shared));
      const ids = links.map(({ externalId }) => externalId);
      assert.ok(
        ids.includes(own),
        "own link appears even without observations",
      );
      assert.ok(
        ids.includes(shared),
        "observed UUID matches a shared link ignoring case",
      );
      assert.ok(
        !ids.includes(foreign),
        "another source's observations cannot expose its link",
      );
      assert.ok(!ids.includes(legacy), "only UUID links may be shared");
      assert.ok(
        ids.includes(ownLegacy),
        "legacy identifiers retain their case",
      );

      assert.deepEqual(
        await warehouseLinks.save(
          source.code,
          { externalId: shared, warehouseId },
          admin.id,
        ),
        { externalId: shared, warehouseId },
      );
      assert.equal(
        await prisma.warehouseExternalWarehouse.count({
          where: { externalId: { equals: shared, mode: "insensitive" } },
        }),
        1,
        "saving the same shared link does not duplicate it",
      );
      await assert.rejects(
        warehouseLinks.save(
          source.code,
          {
            externalId: shared,
            warehouseId: String(warehouse.foreign.id),
          },
          admin.id,
        ),
        (error) =>
          error.getResponse().code === "WAREHOUSE_RECEIPT_MAPPING_CONFLICT",
      );
    },
  );
}
