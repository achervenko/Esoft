import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
export const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};

export async function createIssueSheetsTestContext(prisma) {
  const namespace = "sheets-" + randomUUID();
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
  const { captureIssueHeader, captureIssuePosition, issueHistorySearch } = load(
    "warehouse/issues/issues-history.js",
  );
  const { balanceSelect } = load("warehouse/stock/stock.types.js");
  const { WarehouseIssuesQueryService } = load(
    "warehouse/issues/issues-query.service.js",
  );
  const issueQueries = new WarehouseIssuesQueryService(prisma);
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
      id: `${namespace}-keeper`,
      name: "Keeper",
      email: `${namespace}-keeper@test.invalid`,
      role: "storekeeper",
    },
  });
  const unauthorized = await prisma.user.create({
    data: {
      id: `${namespace}-denied`,
      name: "Denied",
      email: `${namespace}-denied@test.invalid`,
      role: "accounting_specialist",
    },
  });
  const item = await prisma.warehouseItem.create({
    data: { article: `${namespace}-1`, name: "Ботинки", unit: "пар" },
  });
  const otherItem = await prisma.warehouseItem.create({
    data: { article: `${namespace}-2`, name: "Каски", unit: "шт" },
  });
  const location = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { name: namespace },
          create: { name: namespace },
        },
      },

      name: "Полка",
    },
  });
  const project = await prisma.warehouseProject.create({
    data: { projectNumber: namespace },
  });
  const balance = await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: location.id, quantity: "100" },
  });
  const create = (name = "Лист") =>
    service.create(
      {
        warehouseId: String(location.warehouseId),
        name,
        sourceFileName: "source.xlsx",
        sourceFileHash: "a".repeat(64),
      },
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
            const data = {
              warehouseId: location.warehouseId,
              type: "ISSUE_SHEET",
              issueSheetLineId: BigInt(line.id),
              projectId: current.projectId,
              issuedByUserId: actor.id,
              ...extra,
            };
            const savedBalance = await tx.warehouseBalance.findUniqueOrThrow({
              where: { id: balance.id },
              select: balanceSelect,
            });
            // This low-level execution fixture does not consume project reservations.
            const snapshot = await captureIssueHeader(
              tx,
              data.issuedByUserId,
              data.projectId,
              data.issueSheetLineId,
              {
                warehouseId: data.warehouseId,
                changes: [],
                foreignReservations: [],
              },
            );
            const positionSnapshot = captureIssuePosition({
              balance: savedBalance,
            });
            return tx.warehouseIssue.create({
              data: {
                ...data,
                snapshot,
                searchText: issueHistorySearch(
                  snapshot,
                  [positionSnapshot],
                  data.comment ?? null,
                ),
                positions: {
                  create: {
                    snapshot: positionSnapshot,
                    balanceId: balance.id,
                    quantity,
                  },
                },
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

  return {
    prisma,
    service,
    queries,
    issueQueries,
    actor,
    unauthorized,
    item,
    otherItem,
    location,
    project,
    balance,
    create,
    add,
    issue,
    stockQuantity,
    makeService,
    WarehouseIssueSheetTransactions,
  };
}
