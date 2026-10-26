import assert from "node:assert/strict";

export async function verifyReservationsPermissions({
  prisma,
  api,
  actor,
  projects,
  fixture,
  create,
}) {
  const rollback = await fixture();
  const rr = await create(rollback.balance, projects[0], "5");
  const mutations = (id) => [
    () =>
      api.create(
        {
          balanceId: String(rollback.balance.id),
          projectId: String(projects[1].id),
          quantity: "1",
        },
        id,
      ),
    () => api.update(rr.id, { quantity: "1" }, id),
    () => api.release(rr.id, id),
  ];
  for (const id of ["", "missing"])
    for (const action of mutations(id))
      await assert.rejects(action(), (e) => e.getStatus() === 403);
  for (const state of [{ banned: true }, { banned: false, role: "operator" }]) {
    await prisma.user.update({ where: { id: actor.id }, data: state });
    for (const action of mutations(actor.id))
      await assert.rejects(action(), (e) => e.getStatus() === 403);
  }
  await prisma.user.update({
    where: { id: actor.id },
    data: { role: "storekeeper", banned: false },
  });
}
