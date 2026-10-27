import assert from "node:assert/strict";
import { code } from "./warehouse-issue-sheets-test-context.mjs";

export async function verifyIssueSheetsBasic(context) {
  const {
    prisma,
    service,
    queries,
    actor,
    unauthorized,
    item,
    otherItem,
    location,
    create,
    add,
    stockQuantity,
  } = context;
  await assert.rejects(
    service.create(
      { name: "Denied", warehouseId: String(location.warehouseId) },
      unauthorized.id,
    ),
    code("FORBIDDEN"),
  );
  const sheet = await create("100%_Лист");
  assert.equal(sheet.status, "DRAFT");
  assert.equal(sheet.createdByUserId, actor.id);
  assert.equal(Object.hasOwn(await queries.findOne(sheet.id), "lines"), false);
  await assert.rejects(
    service.markReady(sheet.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_NOT_READY"),
  );
  await assert.rejects(
    service.finalize(sheet.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_STATE"),
  );
  const line = await add(sheet);
  assert.equal(line.unitSnapshot, "пар");
  assert.equal(line.requiredQuantity, "20");
  assert.equal(line.executionState, "NOT_STARTED");
  assert.doesNotThrow(() => JSON.stringify(line));
  await assert.rejects(add(sheet), code("WAREHOUSE_ISSUE_SHEET_ROW_EXISTS"));
  const otherSheet = await create("Другой");
  await assert.rejects(
    service.updateLine(otherSheet.id, line.id, { quantity: "2" }, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_LINE_NOT_FOUND"),
  );
  await service.markReady(sheet.id, actor.id);
  await service.updateLine(sheet.id, line.id, { quantity: "20" }, actor.id);
  assert.equal((await queries.findOne(sheet.id)).status, "DRAFT");
  const corrected = await service.updateLine(
    sheet.id,
    line.id,
    { itemId: String(otherItem.id) },
    actor.id,
  );
  assert.equal(corrected.unitSnapshot, "шт");
  await service.updateLine(
    sheet.id,
    line.id,
    { itemId: String(item.id) },
    actor.id,
  );
  await service.markReady(sheet.id, actor.id);
  assert.equal(await stockQuantity(), "100");
  const cancelled = await create("Отмена");
  const cancelledLine = await add(cancelled);
  const cancelledResult = await service.cancel(cancelled.id, actor.id);
  const cancelAuditCount = await prisma.auditLog.count();
  const cancelStockQuantity = await stockQuantity();
  assert.deepEqual(
    await service.cancel(cancelled.id, actor.id),
    cancelledResult,
  );
  assert.equal(await prisma.auditLog.count(), cancelAuditCount);
  assert.equal(await stockQuantity(), cancelStockQuantity);
  await assert.rejects(
    service.updateLine(
      cancelled.id,
      cancelledLine.id,
      { quantity: "1" },
      actor.id,
    ),
    code("WAREHOUSE_ISSUE_SHEET_CLOSED"),
  );
  await assert.rejects(
    service.finalize(cancelled.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_STATE"),
  );
  const unmatched = await create("Ошибки");
  const unmatchedLine = await add(unmatched, "3", {
    itemId: null,
    matchingStatus: "ERROR",
    error: "Не найдено",
  });
  await assert.rejects(
    service.markReady(unmatched.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_NOT_READY"),
  );
  await service.removeLine(unmatched.id, unmatchedLine.id, actor.id);
  assert.equal((await queries.lines(unmatched.id, {})).total, 0);
  await prisma.user.update({ where: { id: actor.id }, data: { banned: true } });
  await assert.rejects(create("Banned"), code("FORBIDDEN"));
}
