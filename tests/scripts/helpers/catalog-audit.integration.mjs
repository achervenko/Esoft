import assert from "node:assert/strict";
export async function verifyCatalogAudit({
  prisma,
  actor,
  service,
  create,
  WarehouseCatalogService,
}) {
  const first = await create("AUDIT-1", { comment: "Audit fixture" });
  const createAudit = await prisma.auditLog.findMany({
    where: { entityType: "warehouse_item", entityStringId: first.id },
  });
  assert.equal(createAudit.length, 5);
  assert.ok(
    createAudit.every(
      (row) =>
        row.module === "WAREHOUSE" &&
        row.action === "CREATE" &&
        row.userId === actor.id &&
        row.entityId === null,
    ),
  );
  assert.deepEqual(
    await service.update(first.id, { name: "Подшипник" }, actor.id),
    first,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { entityStringId: first.id, entityType: "warehouse_item" },
    }),
    5,
  );
  const updated = await service.update(
    first.id,
    { name: "Новое имя", comment: null, unit: "м" },
    actor.id,
  );
  assert.equal(updated.article, "AUDIT-1");
  assert.equal(updated.comment, null);
  assert.equal(updated.unit, "м");
  assert.equal(updated.id, first.id);
  const changedFields = await prisma.auditLog.findMany({
    where: {
      entityStringId: first.id,
      action: "UPDATE",
      entityType: "warehouse_item",
    },
  });
  assert.equal(changedFields.length, 3);

  await service.setStatus(first.id, { isActive: false }, actor.id);
  const auditCount = await prisma.auditLog.count({
    where: { entityStringId: first.id, entityType: "warehouse_item" },
  });
  await service.setStatus(first.id, { isActive: false }, actor.id);
  assert.equal(
    await prisma.auditLog.count({
      where: { entityStringId: first.id, entityType: "warehouse_item" },
    }),
    auditCount,
  );
  const second = await create("AUDIT-2");
  const failedAudit = new WarehouseCatalogService(prisma, {
    async writeFieldChanges() {
      throw new Error("Injected audit failure");
    },
  });
  await assert.rejects(
    failedAudit.create(
      { article: "CAT-ROLLBACK", name: "Rollback", unit: "шт" },
      actor.id,
    ),
    /Injected audit failure/,
  );
  assert.equal(
    await prisma.warehouseItem.count({ where: { article: "CAT-ROLLBACK" } }),
    0,
  );
  await assert.rejects(
    failedAudit.update(second.id, { name: "Rollback update" }, actor.id),
    /Injected audit failure/,
  );
  assert.equal((await service.findOne(second.id)).name, "Подшипник");
  await assert.rejects(
    failedAudit.setStatus(second.id, { isActive: false }, actor.id),
    /Injected audit failure/,
  );
  assert.equal((await service.findOne(second.id)).isActive, true);
  // An audit unique conflict must propagate unchanged, rolling back the item.
  const existingAudit = await prisma.auditLog.findFirstOrThrow({
    orderBy: { id: "asc" },
  });
  const auditCountBefore = await prisma.auditLog.count();
  let auditConflict;
  const conflictingAudit = new WarehouseCatalogService(prisma, {
    async writeFieldChanges({ tx }) {
      try {
        await tx.auditLog.create({
          data: {
            id: existingAudit.id,
            userId: actor.id,
            module: "WAREHOUSE",
            action: "CREATE",
            entityType: "warehouse_item",
          },
        });
      } catch (error) {
        auditConflict = error;
        throw error;
      }
    },
  });
  await assert.rejects(
    conflictingAudit.create(
      { article: "CAT-AUDIT-UNIQUE", name: "Rollback", unit: "шт" },
      actor.id,
    ),
    (error) => {
      assert.equal(error, auditConflict);
      assert.equal(error.code, "P2002");
      assert.equal(error.meta?.modelName, "AuditLog");
      assert.notEqual(error.response?.code, "WAREHOUSE_ARTICLE_EXISTS");
      return true;
    },
  );
  assert.equal(
    await prisma.warehouseItem.count({
      where: { article: "CAT-AUDIT-UNIQUE" },
    }),
    0,
  );
  assert.equal(await prisma.auditLog.count(), auditCountBefore);
}
