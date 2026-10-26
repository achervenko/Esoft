import assert from "node:assert/strict";
import { code } from "./reservations-test-context.mjs";

export async function verifyReservationsBasic({
  prisma,
  api,
  actor,
  projects,
  fixture,
  create,
}) {
  const f = await fixture();
  const r = await create(f.balance, projects[0], "20.000");
  assert.equal(r.quantity, "20");
  assert.equal(r.project.projectNumber, "A");
  assert.equal(r.item.id, String(f.item.id));
  await assert.rejects(
    prisma.warehouseProject.delete({ where: { id: projects[0].id } }),
    { code: "P2003" },
  );
  assert.equal(
    (
      await prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: { id: BigInt(r.id) },
      })
    ).projectId,
    projects[0].id,
  );
  await create(f.balance, projects[1], "60");
  await assert.rejects(
    create(f.balance, projects[2], "30"),
    code("WAREHOUSE_RESERVATION_INSUFFICIENT"),
  );
  await assert.rejects(
    create(f.balance, projects[0], "1"),
    code("WAREHOUSE_RESERVATION_EXISTS"),
  );
  await assert.rejects(
    api.update(r.id, { quantity: "40.001" }, actor.id),
    code("WAREHOUSE_RESERVATION_INSUFFICIENT"),
  );
  assert.equal(
    (await api.update(r.id, { quantity: "40" }, actor.id)).quantity,
    "40",
  );
  assert.equal(
    (
      await api.list({
        balanceId: String(f.balance.id),
        projectId: String(projects[0].id),
        itemId: String(f.item.id),
        locationId: String(f.location.id),
        limit: "1",
      })
    ).total,
    1,
  );
  // A deficit may be repaired by reducing or releasing existing demand.
  await prisma.warehouseBalance.update({
    where: { id: f.balance.id },
    data: { quantity: "10" },
  });
  await prisma.warehouseProject.update({
    where: { id: projects[0].id },
    data: { isActive: false },
  });
  await prisma.warehouseStorageLocation.update({
    where: { id: f.location.id },
    data: { isActive: false },
  });
  assert.equal(
    (await api.update(r.id, { quantity: "30" }, actor.id)).quantity,
    "30",
  );
  await assert.rejects(
    api.update(r.id, { quantity: "31" }, actor.id),
    code("WAREHOUSE_RESERVATION_UNAVAILABLE"),
  );
  await api.release(r.id, actor.id);
  assert.equal(
    await prisma.warehouseProjectReservation.count({
      where: { id: BigInt(r.id) },
    }),
    0,
  );
  await assert.rejects(
    api.release(r.id, actor.id),
    code("WAREHOUSE_RESERVATION_NOT_FOUND"),
  );
  await prisma.warehouseProject.update({
    where: { id: projects[0].id },
    data: { isActive: true },
  });
}
