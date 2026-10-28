import assert from "node:assert/strict";
export async function verifyCatalogConstraints({
  prisma,
  actor,
  service,
  create,
}) {
  const first = await create("CONSTRAINT-1", { comment: "For constraints" });
  const second = await create("CONSTRAINT-2");
  const auditBeforeDuplicate = await prisma.auditLog.count({
    where: { entityStringId: first.id, entityType: "warehouse_item" },
  });
  await assert.rejects(
    create("CONSTRAINT-1"),
    (error) => error.response?.code === "WAREHOUSE_ARTICLE_EXISTS",
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { entityStringId: first.id, entityType: "warehouse_item" },
    }),
    auditBeforeDuplicate,
  );
  await assert.rejects(
    service.update(first.id, { article: second.article }, actor.id),
    (error) => error.response?.code === "WAREHOUSE_ARTICLE_EXISTS",
  );
  assert.equal((await service.findOne(first.id)).article, "CONSTRAINT-1");
  await service.update(first.id, { name: "Новое имя", unit: "м" }, actor.id);
  const location = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { name: "TEST" },
          create: { name: "TEST" },
        },
      },

      name: "Shelf",
    },
  });
  const balance = await prisma.warehouseBalance.create({
    data: {
      itemId: BigInt(first.id),
      storageLocationId: location.id,
      quantity: "2",
    },
  });
  const project = await prisma.warehouseProject.create({
    data: { projectNumber: "CAT-PROJECT" },
  });
  const reservation = await prisma.warehouseProjectReservation.create({
    data: { balanceId: balance.id, projectId: project.id, quantity: "1" },
  });
  await assert.rejects(
    service.update(
      first.id,
      { unit: "кг", name: "Must not persist" },
      actor.id,
    ),
    (error) => error.response?.code === "WAREHOUSE_UNIT_IN_USE",
  );
  assert.equal((await service.findOne(first.id)).name, "Новое имя");
  await service.update(first.id, { unit: "м", comment: "Used item" }, actor.id);
  await service.setStatus(first.id, { isActive: false }, actor.id);
  assert.equal(
    (
      await prisma.warehouseBalance.findUniqueOrThrow({
        where: { id: balance.id },
      })
    ).quantity.toString(),
    "2",
  );
  assert.equal(
    (
      await prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: { id: reservation.id },
      })
    ).balanceId,
    balance.id,
  );

  const sheet = await prisma.warehouseIssueSheet.create({
    data: {
      warehouseId: location.warehouseId,
      name: "Catalog reference",
      status: "draft",
      createdByUserId: actor.id,
    },
  });
  await prisma.warehouseIssueSheetLine.create({
    data: {
      issueSheetId: sheet.id,
      itemId: BigInt(second.id),
      quantity: "1",
      matchingStatus: "matched",
      rowNumber: 1,
      unitSnapshot: "шт",
    },
  });
  await assert.rejects(
    service.update(second.id, { unit: "кг" }, actor.id),
    (error) => error.response?.code === "WAREHOUSE_UNIT_IN_USE",
  );

  for (const action of [
    () => service.findOne("9223372036854775807"),
    () => service.update("9223372036854775807", { name: "Missing" }, actor.id),
    () =>
      service.setStatus("9223372036854775807", { isActive: false }, actor.id),
  ])
    await assert.rejects(
      action(),
      (error) => error.response?.code === "WAREHOUSE_ITEM_NOT_FOUND",
    );
  await assert.rejects(
    service.create(
      { article: "BAD", name: "Item", unit: "шт", externalId: "not-supported" },
      actor.id,
    ),
    (error) => error.response?.code === "UNKNOWN_FIELDS",
  );
}
