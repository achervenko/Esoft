import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-issues-test-context.mjs";

export async function verifyWarehouseIssuesSheets(context) {
  const {
    warehouse,
    fixture,
    payload,
    service,
    queries,
    sheets,
    sheetQueries,
    keeper,
    admin,
    projects,
  } = context;
  const forSheet = await fixture(["20", "20"]);
  const sheet = await sheets.create(
    { name: "Задание", warehouseId: String(warehouse.id) },
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
  const sheetInput = payload(forSheet, ["3", "4"], {
    type: "ISSUE_SHEET",
    issueSheetLineId: line.id,
  });
  const sheetIssue = await service.createIssueFromSheet(sheetInput, keeper.id);
  assert.equal(sheetIssue.projectId, String(projects[0].id));
  assert.equal((await sheetQueries.findOne(sheet.id)).status, "IN_PROGRESS");
  assert.equal(
    (await sheetQueries.lines(sheet.id, {})).items[0].remainingQuantity,
    "3",
  );
  await assert.rejects(
    service.createIssue({ ...sheetInput, requestKey: randomUUID() }, keeper.id),
    code("WAREHOUSE_ISSUE_SHEET_OVERISSUED"),
  );
  const smallSheetInput = {
    ...sheetInput,
    requestKey: randomUUID(),
    positions: [{ balanceId: String(forSheet.balances[0].id), quantity: "1" }],
  };
  await assert.rejects(
    service.createIssue(
      { ...smallSheetInput, projectId: String(projects[1].id) },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_PROJECT_MISMATCH"),
  );
  const previewSheet = await service.previewOverride(
    { ...smallSheetInput, overrideReservations: true, comment: "Согласовано" },
    admin.id,
  );
  await service.createIssue(
    {
      ...smallSheetInput,
      overrideReservations: true,
      comment: "Согласовано",
      overrideConfirmation: previewSheet.confirmationToken,
    },
    admin.id,
  );
  assert.equal(
    (await sheets.finalize(sheet.id, keeper.id)).status,
    "PROCESSED_WITH_SHORTAGE",
  );
  await assert.rejects(
    service.createIssue(smallSheetInput, keeper.id),
    code("WAREHOUSE_ISSUE_SHEET_STATE"),
  );
  const filtered = await queries.list({
    itemId: String(forSheet.item.id),
    issueSheetId: sheet.id,
    types: "ISSUE_SHEET",
    sortBy: "quantity",
    sortOrder: "asc",
  });
  assert.equal(filtered.total, 2);
  assert.equal(filtered.items[0].totalQuantity, "1");
  assert.equal(
    (
      await queries.list({
        overrideReservations: true,
        projectId: String(projects[0].id),
        issueSheetLineId: line.id,
      })
    ).total,
    1,
  );
}
