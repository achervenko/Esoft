import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-issues-test-context.mjs";

export async function verifyWarehouseIssuesIdempotency(context) {
  const {
    prisma,
    warehouse,
    fixture,
    payload,
    service,
    sheets,
    keeper,
    admin,
    projects,
    balanceQuantity,
    reserveQuantity,
    createBrokenService,
  } = context;
  const broken = createBrokenService();
  const forSheet = await fixture(["20"]);
  const sheet = await sheets.create(
    { name: "Replay sheet", warehouseId: String(warehouse.id) },
    keeper.id,
  );
  const line = await sheets.addLine(
    sheet.id,
    {
      itemId: String(forSheet.item.id),
      projectId: String(projects[0].id),
      quantity: "10",
      rowNumber: 1,
      matchingStatus: "MATCHED",
    },
    keeper.id,
  );
  await sheets.markReady(sheet.id, keeper.id);
  const sheetInput = payload(forSheet, ["7"], {
    type: "ISSUE_SHEET",
    issueSheetLineId: line.id,
  });
  const sheetIssue = await service.createIssueFromSheet(sheetInput, keeper.id);
  await sheets.finalize(sheet.id, keeper.id);
  const forced = await fixture(["100"], [["50", "20", "10"]]);
  const forceInput = payload(forced, ["45"], {
    overrideReservations: true,
    comment: "Replay override",
  });
  const preview = await service.previewOverride(forceInput, admin.id);
  const confirmed = await service.createIssue(
    { ...forceInput, overrideConfirmation: preview.confirmationToken },
    admin.id,
  );
  // Successful retries return the exact saved JSON and never repeat effects.
  const replayFixture = await fixture(["100", "100"], [["20"], []]);
  const replayInput = payload(replayFixture, ["5", "2"], {
    projectId: String(projects[0].id),
    comment: " Replay ",
  });
  const replayFirst = await service.createManualIssue(replayInput, keeper.id);
  const replayIssues = await prisma.warehouseIssue.count();
  const replayAudits = await prisma.auditLog.count();
  const replayReserves = await reserveQuantity(
    replayFixture.balances[0].id,
    projects[0].id,
  );
  const replaySecond = await service.createIssue(
    {
      ...replayInput,
      requestKey: replayInput.requestKey.toUpperCase(),
      comment: "Replay",
      positions: [...replayInput.positions]
        .reverse()
        .map((p) => ({ ...p, quantity: p.quantity + ".000" })),
    },
    keeper.id,
  );
  assert.deepEqual(replaySecond, replayFirst);
  assert.equal(await balanceQuantity(replayFixture.balances[0].id), "95");
  assert.equal(
    await reserveQuantity(replayFixture.balances[0].id, projects[0].id),
    replayReserves,
  );
  assert.equal(await prisma.warehouseIssue.count(), replayIssues);
  assert.equal(await prisma.auditLog.count(), replayAudits);
  await assert.rejects(
    service.createIssue({ ...replayInput, comment: "Changed" }, keeper.id),
    code("WAREHOUSE_ISSUE_REQUEST_CONFLICT"),
  );
  await assert.rejects(
    service.createIssue(
      {
        ...replayInput,
        positions: [{ ...replayInput.positions[0], quantity: "6" }],
      },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_REQUEST_CONFLICT"),
  );
  const sameKeyFixture = await fixture(["100"]);
  const sameKeyInput = payload(sameKeyFixture, ["5"]);
  const sameKeyBefore = await prisma.warehouseIssue.count();
  const identicalRace = await Promise.all(
    Array.from({ length: 6 }, () =>
      service.createIssue(sameKeyInput, keeper.id),
    ),
  );
  assert.equal(new Set(identicalRace.map((r) => r.id)).size, 1);
  assert.equal(await prisma.warehouseIssue.count(), sameKeyBefore + 1);
  assert.equal(await balanceQuantity(sameKeyFixture.balances[0].id), "95");
  // Scope is per actor: another authorized user may use the same UUID for a new command.
  const otherActor = await service.createIssue(sameKeyInput, admin.id);
  assert.notEqual(otherActor.id, identicalRace[0].id);
  assert.equal(await balanceQuantity(sameKeyFixture.balances[0].id), "90");
  const differentRaceFixture = await fixture(["100"]);
  const differentRaceInput = payload(differentRaceFixture, ["5"]);
  const differentRace = await Promise.allSettled([
    service.createIssue(differentRaceInput, keeper.id),
    service.createIssue({ ...differentRaceInput, comment: "Other" }, keeper.id),
  ]);
  assert.equal(differentRace.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    differentRace.find((r) => r.status === "rejected").reason.response.code,
    "WAREHOUSE_ISSUE_REQUEST_CONFLICT",
  );
  assert.equal(
    await balanceQuantity(differentRaceFixture.balances[0].id),
    "95",
  );
  // Replay bypasses closed sheet/consumed requirement, but a new command does not.
  assert.deepEqual(
    await service.createIssueFromSheet(sheetInput, keeper.id),
    sheetIssue,
  );
  await assert.rejects(
    service.createIssue({ ...sheetInput, requestKey: randomUUID() }, keeper.id),
    code("WAREHOUSE_ISSUE_SHEET_STATE"),
  );
  // Repeating the confirmed operation needs no new preview/token even after the stock changed.
  assert.deepEqual(await service.createIssue(forceInput, admin.id), confirmed);
  await prisma.warehouseItem.update({
    where: { id: replayFixture.item.id },
    data: { name: "Renamed", isActive: false },
  });
  await prisma.warehouseStorageLocation.update({
    where: { id: replayFixture.balances[0].storageLocationId },
    data: { name: "Renamed location", isActive: false },
  });
  await prisma.warehouseProject.update({
    where: { id: projects[0].id },
    data: { isActive: false },
  });
  assert.deepEqual(
    await service.createIssue(replayInput, keeper.id),
    replayFirst,
  );
  await prisma.warehouseProject.update({
    where: { id: projects[0].id },
    data: { isActive: true },
  });
  const retryFailure = await fixture(["10"]);
  const retryFailureInput = payload(retryFailure, ["2"]);
  const requestsBeforeFailure = await prisma.warehouseIssueRequest.count();
  await assert.rejects(
    broken.createIssue(retryFailureInput, keeper.id),
    /Issue audit unavailable/,
  );
  assert.equal(
    await prisma.warehouseIssueRequest.count(),
    requestsBeforeFailure,
  );
  assert.equal(await balanceQuantity(retryFailure.balances[0].id), "10");
  await service.createIssue(retryFailureInput, keeper.id);
  assert.equal(await balanceQuantity(retryFailure.balances[0].id), "8");
  const storedRequest = await prisma.warehouseIssueRequest.findUniqueOrThrow({
    where: {
      actorUserId_requestKey: {
        actorUserId: keeper.id,
        requestKey: replayInput.requestKey,
      },
    },
  });
  await assert.rejects(
    prisma.warehouseIssueRequest.create({
      data: {
        ...storedRequest,
        requestKey: randomUUID(),
        issueId: BigInt(otherActor.id),
      },
    }),
    { code: "P2002" },
  );
  await prisma.user.update({
    where: { id: admin.id },
    data: { role: "storekeeper" },
  });
  await assert.rejects(
    service.createIssue(forceInput, admin.id),
    code("FORBIDDEN"),
  );
  await prisma.user.update({
    where: { id: admin.id },
    data: { role: "admin" },
  });
  await prisma.user.update({
    where: { id: keeper.id },
    data: { banned: true },
  });
  await assert.rejects(
    service.createIssue(replayInput, keeper.id),
    code("FORBIDDEN"),
  );
}
