import assert from "node:assert/strict";

export async function verifyReservationsAudit({
  prisma,
  api,
  stock,
  reservations,
  actor,
  projects,
  fixture,
  create,
  WarehouseReservationsApiService,
}) {
  const noop = await fixture();
  const unchanged = await create(noop.balance, projects[0], "5");
  const beforeNoop = await prisma.auditLog.count();
  await api.update(unchanged.id, { quantity: unchanged.quantity }, actor.id);
  assert.equal(await prisma.auditLog.count(), beforeNoop);
  const failed = new WarehouseReservationsApiService(
    prisma,
    stock,
    reservations,
    {
      writeFieldChanges: async () => {
        throw new Error("audit failure");
      },
    },
  );
  const rollback = await fixture();
  await assert.rejects(
    failed.create(
      {
        balanceId: String(rollback.balance.id),
        projectId: String(projects[0].id),
        quantity: "1",
      },
      actor.id,
    ),
    /audit failure/,
  );
  assert.equal(
    await prisma.warehouseProjectReservation.count({
      where: { balanceId: rollback.balance.id },
    }),
    0,
  );
  const rr = await create(rollback.balance, projects[0], "5");
  await assert.rejects(
    failed.update(rr.id, { quantity: "6" }, actor.id),
    /audit failure/,
  );
  await assert.rejects(failed.release(rr.id, actor.id), /audit failure/);
  assert.equal(
    (
      await prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: { id: BigInt(rr.id) },
      })
    ).quantity.toString(),
    "5",
  );
}
