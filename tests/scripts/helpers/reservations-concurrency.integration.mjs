import assert from "node:assert/strict";

export async function verifyReservationsConcurrency({
  prisma,
  api,
  issues,
  actor,
  projects,
  fixture,
  create,
}) {
  const race = await fixture();
  const outcome = await Promise.allSettled([
    create(race.balance, projects[0], "70"),
    create(race.balance, projects[1], "70"),
  ]);
  assert.equal(outcome.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    outcome.find((x) => x.status === "rejected").reason.response.code,
    "WAREHOUSE_RESERVATION_INSUFFICIENT",
  );
  const duplicate = await fixture();
  const dup = await Promise.allSettled([
    create(duplicate.balance, projects[0], "1"),
    create(duplicate.balance, projects[0], "1"),
  ]);
  assert.equal(dup.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    dup.find((x) => x.status === "rejected").reason.response.code,
    "WAREHOUSE_RESERVATION_EXISTS",
  );

  const patchRace = await fixture("10");
  const pr1 = await create(patchRace.balance, projects[0], "2");
  const pr2 = await create(patchRace.balance, projects[1], "2");
  const updates = await Promise.allSettled([
    api.update(pr1.id, { quantity: "7" }, actor.id),
    api.update(pr2.id, { quantity: "7" }, actor.id),
  ]);
  assert.equal(updates.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    updates.find((x) => x.status === "rejected").reason.response.code,
    "WAREHOUSE_RESERVATION_INSUFFICIENT",
  );
  // Reservations and actual Issues serialize on the same Stock balance lock.
  const concurrent = await fixture("10");
  const results = await Promise.allSettled([
    create(concurrent.balance, projects[0], "8"),
    issues.createIssue(
      {
        type: "MANUAL",
        positions: [
          { balanceId: String(concurrent.balance.id), quantity: "8" },
        ],
      },
      actor.id,
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const physical = (
    await prisma.warehouseBalance.findUniqueOrThrow({
      where: { id: concurrent.balance.id },
    })
  ).quantity;
  const reserved = (
    await prisma.warehouseProjectReservation.aggregate({
      where: { balanceId: concurrent.balance.id },
      _sum: { quantity: true },
    })
  )._sum.quantity;
  assert.ok(!reserved || physical.gte(reserved));
}
