import assert from "node:assert/strict";
import { code } from "./warehouse-issue-sheets-test-context.mjs";

export async function verifyIssueSheetsExecution(context) {
  const {
    prisma,
    service,
    queries,
    issueQueries,
    actor,
    item,
    location,
    project,
    create,
    add,
    issue,
    stockQuantity,
  } = context;
  const sheet = await create("100%_Лист");
  const line = await add(sheet);
  await service.markReady(sheet.id, actor.id);
  const firstIssue = await issue(line, "8");
  const history = await issueQueries.get(String(firstIssue.id));
  assert.deepEqual(history.project, {
    id: String(project.id),
    projectNumber: project.projectNumber,
    name: project.name,
  });
  assert.deepEqual(history.issuedBy, { id: actor.id, name: actor.name });
  assert.deepEqual(history.issueSheet, {
    id: sheet.id,
    name: sheet.name,
    rowNumber: 1,
  });
  assert.equal(history.warehouse.id, String(location.warehouseId));
  assert.deepEqual(history.positions[0].item, {
    id: String(item.id),
    article: item.article,
    name: item.name,
    unit: item.unit,
  });
  assert.equal(history.positions[0].location.id, String(location.id));
  assert.equal(
    history.positions[0].location.warehouse.id,
    history.warehouse.id,
  );
  assert.deepEqual(history.reservationUsage, []);
  assert.equal(history.foreignReservationsUsed, false);
  assert.doesNotThrow(() => JSON.stringify(history));
  const found = await issueQueries.list({
    warehouseId: String(location.warehouseId),
    search: item.article,
  });
  assert.equal(found.total, 1);
  assert.deepEqual(found.items[0], history);
  await issue(line, "7");
  assert.equal((await queries.findOne(sheet.id)).status, "IN_PROGRESS");
  const progress = (await queries.lines(sheet.id, {})).items[0];
  assert.equal(progress.issuedQuantity, "15");
  assert.equal(progress.remainingQuantity, "5");
  assert.equal(progress.executionState, "PARTIAL");
  assert.equal(progress.sourceArticle, "Original");
  assert.equal(
    (await queries.lines(sheet.id, { executionState: "PARTIAL" })).total,
    1,
  );
  assert.equal(
    (await queries.lines(sheet.id, { executionState: "COMPLETED" })).total,
    0,
  );
  await assert.rejects(
    service.updateLine(sheet.id, line.id, { quantity: "21" }, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_LINE_STARTED"),
  );
  await assert.rejects(
    service.removeLine(sheet.id, line.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_LINE_STARTED"),
  );
  await assert.rejects(
    service.cancel(sheet.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_CANNOT_CANCEL"),
  );
  await assert.rejects(
    issue(line, "6"),
    code("WAREHOUSE_ISSUE_SHEET_OVERISSUED"),
  );
  assert.equal(await stockQuantity(), "85");
  const shortage = await service.finalize(sheet.id, actor.id);
  assert.equal(shortage.status, "PROCESSED_WITH_SHORTAGE");
  assert.equal(shortage.processedByUserId, actor.id);
  const auditCount = await prisma.auditLog.count();
  assert.deepEqual(await service.finalize(sheet.id, actor.id), shortage);
  assert.equal(await prisma.auditLog.count(), auditCount);
  assert.equal(await stockQuantity(), "85");
  await assert.rejects(issue(line, "1"), code("WAREHOUSE_ISSUE_SHEET_STATE"));
  await assert.rejects(
    service.removeLine(sheet.id, line.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_CLOSED"),
  );
  await assert.rejects(
    add(sheet, "1", { rowNumber: 2 }),
    code("WAREHOUSE_ISSUE_SHEET_CLOSED"),
  );

  const complete = await create("Полный");
  const completeLine = await add(complete, "2.125");
  await service.markReady(complete.id, actor.id);
  await issue(completeLine, "1.125");
  await issue(completeLine, "1");
  assert.equal(
    (await service.finalize(complete.id, actor.id)).status,
    "PROCESSED",
  );
  assert.equal(
    (await queries.lines(complete.id, { executionState: "COMPLETED" })).items[0]
      .remainingQuantity,
    "0",
  );
  const noIssue = await create("Нулевая выдача");
  await add(noIssue, "4");
  await service.markReady(noIssue.id, actor.id);
  assert.equal(
    (await service.finalize(noIssue.id, actor.id)).status,
    "PROCESSED_WITH_SHORTAGE",
  );
}
