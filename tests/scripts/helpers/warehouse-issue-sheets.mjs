import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};

export async function verifyIssueSheets(prisma) {
  const { WarehouseIssueSheetsService } = load(
    "warehouse/issue-sheets/issue-sheets.service.js",
  );
  const { WarehouseIssueSheetsQueryService } = load(
    "warehouse/issue-sheets/issue-sheets-query.service.js",
  );
  const { WarehouseIssueSheetTransactions } = load(
    "warehouse/issue-sheets/issue-sheets-transaction.service.js",
  );
  const { WarehouseStockService } = load("warehouse/stock/stock.service.js");
  const { WarehouseStockQueryService } = load(
    "warehouse/stock/stock-query.service.js",
  );
  const { AuditLogService } = load("audit/audit-log.service.js");
  const audit = new AuditLogService(prisma);
  const transactions = new WarehouseIssueSheetTransactions(prisma, audit);
  const { WarehouseIssueSheetLinesService } = load(
    "warehouse/issue-sheets/issue-sheets-lines.service.js",
  );
  const { WarehouseIssueSheetLifecycleService } = load(
    "warehouse/issue-sheets/issue-sheets-lifecycle.service.js",
  );
  const { WarehouseIssueSheetExecutionService } = load(
    "warehouse/issue-sheets/issue-sheets-execution.service.js",
  );
  const makeService = (txs) => {
    const lines = new WarehouseIssueSheetLinesService(txs);
    return new WarehouseIssueSheetsService(
      lines,
      new WarehouseIssueSheetLifecycleService(txs, lines),
      new WarehouseIssueSheetExecutionService(txs),
    );
  };
  const service = makeService(transactions);
  const queries = new WarehouseIssueSheetsQueryService(prisma);
  const stock = new WarehouseStockService(
    new WarehouseStockQueryService(prisma),
    audit,
  );
  const actor = await prisma.user.create({
    data: {
      id: "sheet-keeper",
      name: "Keeper",
      email: "sheets@test.invalid",
      role: "storekeeper",
    },
  });
  const unauthorized = await prisma.user.create({
    data: {
      id: "sheet-denied",
      name: "Denied",
      email: "denied@test.invalid",
      role: "accounting_specialist",
    },
  });
  const item = await prisma.warehouseItem.create({
    data: { article: "SHEET-1", name: "Ботинки", unit: "пар" },
  });
  const otherItem = await prisma.warehouseItem.create({
    data: { article: "SHEET-2", name: "Каски", unit: "шт" },
  });
  const location = await prisma.warehouseStorageLocation.create({
    data: { code: "SHEET-A", name: "Полка" },
  });
  const project = await prisma.warehouseProject.create({
    data: { projectNumber: "SHEET-P" },
  });
  const balance = await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: location.id, quantity: "100" },
  });
  const create = (name = "Лист") =>
    service.create(
      { name, sourceFileName: "source.xlsx", sourceFileHash: "a".repeat(64) },
      actor.id,
    );
  const add = (sheet, quantity = "20", extra = {}) =>
    service.addLine(
      sheet.id,
      {
        itemId: String(item.id),
        projectId: String(project.id),
        quantity,
        matchingStatus: "MATCHED",
        rowNumber: 1,
        sourceArticle: "Original",
        ...extra,
      },
      actor.id,
    );
  const issue = (line, quantity, extra = {}, executor = service) =>
    prisma.$transaction(
      (tx) =>
        executor.executeIssueForLine(
          tx,
          line.id,
          String(item.id),
          quantity,
          actor.id,
          async (current) => {
            await stock.issueStock(
              { tx, actorUserId: actor.id },
              String(item.id),
              String(location.id),
              quantity,
            );
            return tx.warehouseIssue.create({
              data: {
                type: "ISSUE_SHEET",
                issueSheetLineId: BigInt(line.id),
                projectId: current.projectId,
                issuedByUserId: actor.id,
                positions: { create: { balanceId: balance.id, quantity } },
                ...extra,
              },
            });
          },
        ),
      { timeout: 15000 },
    );
  const stockQuantity = async () =>
    (
      await prisma.warehouseBalance.findUniqueOrThrow({
        where: { id: balance.id },
      })
    ).quantity.toString();

  await assert.rejects(
    service.create({ name: "Denied" }, unauthorized.id),
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
  await issue(line, "8");
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
  assert.equal(
    (
      await queries.lines(unmatched.id, {
        matchingStatuses: "ERROR",
        hasError: "true",
        rowFrom: "1",
        rowTo: "1",
      })
    ).total,
    1,
  );
  assert.equal(
    (await queries.list({ hasErrors: true, hasUnmatchedLines: true })).items[0]
      .id,
    unmatched.id,
  );
  assert.equal((await queries.list({ search: "100%_" })).items[0].id, sheet.id);
  assert.equal(
    (
      await queries.list({
        statuses: ["PROCESSED"],
        hasShortage: false,
        itemId: String(item.id),
        projectId: String(project.id),
        processedByUserId: actor.id,
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await queries.list({
        sourceFileHash: "a".repeat(64),
        createdByUserId: actor.id,
        limit: 1,
        page: 2,
      })
    ).items.length,
    1,
  );
  const now = new Date();
  assert.ok(
    (
      await queries.list({
        createdFrom: new Date(now.getTime() - 60000),
        createdTo: now,
        sortBy: "name",
        sortOrder: "asc",
      })
    ).total > 0,
  );
  await service.removeLine(unmatched.id, unmatchedLine.id, actor.id);
  assert.equal((await queries.lines(unmatched.id, {})).total, 0);

  const race = await create("Гонка");
  const raceLine = await add(race, "10");
  await service.markReady(race.id, actor.id);
  const raced = await Promise.allSettled([
    issue(raceLine, "6"),
    issue(raceLine, "6"),
  ]);
  assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    raced.find((r) => r.status === "rejected").reason.response.code,
    "WAREHOUSE_ISSUE_SHEET_OVERISSUED",
  );
  assert.equal((await queries.lines(race.id, {})).items[0].issuedQuantity, "6");
  const beforeFinalizeRace = await stockQuantity();
  const finalRace = await Promise.allSettled([
    service.finalize(race.id, actor.id),
    issue(raceLine, "4"),
  ]);
  assert.equal(finalRace[0].status, "fulfilled");
  assert.ok(
    ["PROCESSED", "PROCESSED_WITH_SHORTAGE"].includes(
      (await queries.findOne(race.id)).status,
    ),
  );
  assert.equal(
    (await queries.lines(race.id, {})).items[0].remainingQuantity,
    finalRace[1].status === "fulfilled" ? "0" : "4",
  );
  assert.ok(Number(await stockQuantity()) <= Number(beforeFinalizeRace));

  const atomic = await create("Атомарность");
  const atomicLine = await add(atomic, "5");
  await service.markReady(atomic.id, actor.id);
  const beforeAtomic = await stockQuantity();
  for (const isolationLevel of ["RepeatableRead", "Serializable"]) {
    let callbackCalled = false;
    await assert.rejects(
      prisma.$transaction(
        (tx) =>
          service.executeIssueForLine(
            tx,
            atomicLine.id,
            String(item.id),
            "1",
            actor.id,
            async () => {
              callbackCalled = true;
            },
          ),
        { isolationLevel },
      ),
      code("WAREHOUSE_ISSUE_SHEET_ISOLATION_REQUIRED"),
    );
    assert.equal(callbackCalled, false);
  }
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );
  await assert.rejects(
    issue(atomicLine, "1", { projectId: null }),
    code("WAREHOUSE_ISSUE_SHEET_ISSUE_MISMATCH"),
  );
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );
  const broken = makeService(
    new WarehouseIssueSheetTransactions(prisma, {
      writeFieldChanges: async () => {
        throw new Error("Audit unavailable");
      },
    }),
  );
  await assert.rejects(
    broken.finalize(atomic.id, actor.id),
    /Audit unavailable/,
  );
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  const issuesBeforeAuditFailure = await prisma.warehouseIssue.count();
  const positionsBeforeAuditFailure =
    await prisma.warehouseIssuePosition.count();
  const auditBeforeIssueFailure = await prisma.auditLog.count();
  let observedIssueBeforeAuditFailure = false;
  const failingIssueAudit = makeService(
    new WarehouseIssueSheetTransactions(prisma, {
      writeFieldChanges: async ({ tx }) => {
        assert.equal(
          (
            await tx.warehouseBalance.findUniqueOrThrow({
              where: { id: balance.id },
            })
          ).quantity.toString(),
          (await import("@prisma/client")).Prisma.Decimal.sub(
            beforeAtomic,
            "1",
          ).toString(),
        );
        assert.equal(
          await tx.warehouseIssue.count(),
          issuesBeforeAuditFailure + 1,
        );
        assert.equal(
          await tx.warehouseIssuePosition.count(),
          positionsBeforeAuditFailure + 1,
        );
        assert.equal(
          (
            await tx.warehouseIssueSheet.findUniqueOrThrow({
              where: { id: BigInt(atomic.id) },
            })
          ).status,
          "IN_PROGRESS",
        );
        observedIssueBeforeAuditFailure = true;
        throw new Error("Issue transition audit unavailable");
      },
    }),
  );
  await assert.rejects(
    issue(atomicLine, "1", {}, failingIssueAudit),
    /Issue transition audit unavailable/,
  );
  assert.equal(observedIssueBeforeAuditFailure, true);
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal(await prisma.warehouseIssue.count(), issuesBeforeAuditFailure);
  assert.equal(
    await prisma.warehouseIssuePosition.count(),
    positionsBeforeAuditFailure,
  );
  assert.equal(await prisma.auditLog.count(), auditBeforeIssueFailure);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );

  const editable = await create("Неначатые строки в исполняемом листе");
  const startedLine = await add(editable, "5");
  const untouchedLine = await add(editable, "2", { rowNumber: 2 });
  await service.markReady(editable.id, actor.id);
  await issue(startedLine, "1");
  const editedLine = await service.updateLine(
    editable.id,
    untouchedLine.id,
    { quantity: "3" },
    actor.id,
  );
  assert.equal(editedLine.quantity, "3");
  assert.equal(editedLine.executionState, "NOT_STARTED");
  const appendedLine = await add(editable, "4", { rowNumber: 3 });
  assert.equal((await queries.findOne(editable.id)).status, "IN_PROGRESS");
  await service.removeLine(editable.id, untouchedLine.id, actor.id);
  const remainingLines = await queries.lines(editable.id, {});
  assert.deepEqual(
    remainingLines.items.map((row) => row.id),
    [startedLine.id, appendedLine.id],
  );
  assert.equal(remainingLines.items[0].issuedQuantity, "1");
  assert.equal(remainingLines.items[1].issuedQuantity, "0");
  assert.equal((await queries.findOne(editable.id)).status, "IN_PROGRESS");
  await prisma.user.update({ where: { id: actor.id }, data: { banned: true } });
  await assert.rejects(create("Banned"), code("FORBIDDEN"));
}
