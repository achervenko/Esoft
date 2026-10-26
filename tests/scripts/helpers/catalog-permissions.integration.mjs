import assert from "node:assert/strict";
export async function verifyCatalogPermissions({
  prisma,
  actor,
  service,
  create,
}) {
  const first = await create("PERMISSION-1");
  const mutations = (actorId) => [
    () =>
      service.create(
        { article: "CAT-DENIED", name: "Denied", unit: "шт" },
        actorId,
      ),
    () => service.update(first.id, { name: "Denied" }, actorId),
    () => service.setStatus(first.id, { isActive: true }, actorId),
  ];
  const itemsBeforeAccessChecks = await prisma.warehouseItem.findMany({
    orderBy: { id: "asc" },
  });
  const logsBeforeAccessChecks = await prisma.auditLog.count();
  for (const actorId of ["", "missing-user"])
    for (const mutation of mutations(actorId))
      await assert.rejects(mutation(), (error) => error.getStatus() === 403);
  for (const state of [{ banned: true }, { banned: false, role: "operator" }]) {
    await prisma.user.update({ where: { id: actor.id }, data: state });
    for (const mutation of mutations(actor.id))
      await assert.rejects(mutation(), (error) => error.getStatus() === 403);
  }
  assert.deepEqual(
    await prisma.warehouseItem.findMany({ orderBy: { id: "asc" } }),
    itemsBeforeAccessChecks,
  );
  assert.equal(await prisma.auditLog.count(), logsBeforeAccessChecks);
  await prisma.user.update({
    where: { id: actor.id },
    data: { banned: false, role: "admin" },
  });
  assert.equal(
    (await service.update(first.id, { comment: "Admin allowed" }, actor.id))
      .comment,
    "Admin allowed",
  );
  await prisma.user.update({
    where: { id: actor.id },
    data: { banned: false, role: actor.role },
  });
}
