import assert from "node:assert/strict";
import { code } from "./warehouse-issues-test-context.mjs";

export async function verifyWarehouseIssuesOverride(context) {
  const {
    prisma,
    fixture,
    payload,
    service,
    queries,
    keeper,
    admin,
    projects,
    balanceQuantity,
    reserveQuantity,
  } = context;
  const forced = await fixture(["100"], [["50", "20", "10"]]);
  const forceInput = payload(forced, ["45"], {
    overrideReservations: true,
    comment: "Аварийная выдача",
  });
  await assert.rejects(
    service.previewOverride(forceInput, keeper.id),
    code("FORBIDDEN"),
  );
  await assert.rejects(
    service.createIssue(forceInput, keeper.id),
    code("FORBIDDEN"),
  );
  await assert.rejects(
    service.createIssue(forceInput, admin.id),
    code("WAREHOUSE_ISSUE_CONFIRMATION_REQUIRED"),
  );
  const preview = await service.previewOverride(forceInput, admin.id);
  assert.equal(preview.foreignReservations[0].quantity, "25");
  assert.equal(await balanceQuantity(forced.balances[0].id), "100");
  await prisma.warehouseProjectReservation.update({
    where: {
      balanceId_projectId: {
        balanceId: forced.balances[0].id,
        projectId: projects[0].id,
      },
    },
    data: { quantity: "45" },
  });
  await assert.rejects(
    service.createIssue(
      { ...forceInput, overrideConfirmation: preview.confirmationToken },
      admin.id,
    ),
    code("WAREHOUSE_ISSUE_CONFIRMATION_REQUIRED"),
  );
  const current = await service.previewOverride(forceInput, admin.id);
  const confirmed = await service.createIssue(
    { ...forceInput, overrideConfirmation: current.confirmationToken },
    admin.id,
  );
  assert.equal(confirmed.foreignReservationsUsed, true);
  assert.equal(await balanceQuantity(forced.balances[0].id), "55");
  assert.equal(
    await reserveQuantity(forced.balances[0].id, projects[0].id),
    "25",
  );
  assert.equal(
    await reserveQuantity(forced.balances[0].id, projects[1].id),
    "20",
  );
  assert.deepEqual(
    (await queries.get(confirmed.id)).reservationUsage,
    confirmed.reservationUsage,
  );
  assert.equal((await queries.get(confirmed.id)).foreignReservationsUsed, true);
  const ordered = await fixture(["100"], [["20", "50", "20"]]);
  const orderedInput = payload(ordered, ["50"], {
    projectId: String(projects[0].id),
    overrideReservations: true,
    comment: "Нужна срочная выдача",
  });
  const orderedPreview = await service.previewOverride(orderedInput, admin.id);
  assert.deepEqual(
    orderedPreview.reservationChanges.map((r) => [
      r.projectId,
      r.quantity,
      r.own,
    ]),
    [
      [String(projects[0].id), "20", true],
      [String(projects[1].id), "20", false],
    ],
  );
  await service.createIssue(
    { ...orderedInput, overrideConfirmation: orderedPreview.confirmationToken },
    admin.id,
  );
  assert.equal(
    await reserveQuantity(ordered.balances[0].id, projects[0].id),
    "0",
  );
  assert.equal(
    await reserveQuantity(ordered.balances[0].id, projects[1].id),
    "30",
  );
  await assert.rejects(
    service.previewOverride(
      payload(await fixture(), ["101"], {
        overrideReservations: true,
        comment: "Причина",
      }),
      admin.id,
    ),
    code("WAREHOUSE_ISSUE_INSUFFICIENT_STOCK"),
  );
}
