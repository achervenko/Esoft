import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
export const code = (expected) => (e) => {
  assert.equal(e.response?.code, expected);
  return true;
};
export async function createReservationsTestContext(prisma) {
  const { AuditLogService } = load("audit/audit-log.service.js");
  const { WarehouseStockService } = load("warehouse/stock/stock.service.js");
  const { WarehouseStockQueryService } = load(
    "warehouse/stock/stock-query.service.js",
  );
  const { WarehouseIssueSheetTransactions } = load(
    "warehouse/issue-sheets/issue-sheets-transaction.service.js",
  );
  const { WarehouseIssueSheetLinesService } = load(
    "warehouse/issue-sheets/issue-sheets-lines.service.js",
  );
  const { WarehouseIssueSheetLifecycleService } = load(
    "warehouse/issue-sheets/issue-sheets-lifecycle.service.js",
  );
  const { WarehouseIssueSheetExecutionService } = load(
    "warehouse/issue-sheets/issue-sheets-execution.service.js",
  );
  const { WarehouseIssueSheetsService } = load(
    "warehouse/issue-sheets/issue-sheets.service.js",
  );
  const { WarehouseIssuesService } = load("warehouse/issues/issues.service.js");
  const { WarehouseIssuesAccessService } = load(
    "warehouse/issues/issues-access.service.js",
  );
  const { WarehouseIssuePlanService } = load(
    "warehouse/issues/issues-plan.service.js",
  );
  const { WarehouseReservationsService } = load(
    "warehouse/reservations/reservations.service.js",
  );
  const audit = new AuditLogService(prisma);
  const stock = new WarehouseStockService(
    new WarehouseStockQueryService(prisma),
    audit,
  );
  const txs = new WarehouseIssueSheetTransactions(prisma, audit);
  const sheetLines = new WarehouseIssueSheetLinesService(txs);
  const sheets = new WarehouseIssueSheetsService(
    sheetLines,
    new WarehouseIssueSheetLifecycleService(txs, sheetLines),
    new WarehouseIssueSheetExecutionService(txs),
  );
  const reservations = new WarehouseReservationsService(audit);
  const plans = new WarehouseIssuePlanService(stock, reservations);
  const access = new WarehouseIssuesAccessService();
  const issues = new WarehouseIssuesService(
    prisma,
    audit,
    access,
    plans,
    stock,
    sheets,
    reservations,
  );

  const { WarehouseReservationsApiService } = load(
    "warehouse/reservations/reservations-api.service.js",
  );
  const api = new WarehouseReservationsApiService(
    prisma,
    stock,
    reservations,
    audit,
  );
  const actor = await prisma.user.create({
    data: {
      id: "res-keeper",
      name: "Keeper",
      email: "res@test.invalid",
      role: "storekeeper",
    },
  });
  const projects = await Promise.all(
    ["A", "B", "C"].map((projectNumber) =>
      prisma.warehouseProject.create({ data: { projectNumber } }),
    ),
  );
  let counter = 0;
  async function fixture(physical = "100") {
    const n = ++counter;
    const item = await prisma.warehouseItem.create({
      data: { article: "RES-" + n, name: "Item", unit: "шт" },
    });
    const location = await prisma.warehouseStorageLocation.create({
      data: {
        warehouse: {
          connectOrCreate: {
            where: { code: "TEST" },
            create: { code: "TEST", name: "Test warehouse" },
          },
        },
        code: "RES-" + n,
        name: "Shelf",
      },
    });
    const balance = await prisma.warehouseBalance.create({
      data: {
        itemId: item.id,
        storageLocationId: location.id,
        quantity: physical,
      },
    });
    return { item, location, balance };
  }
  const create = (b, p, quantity) =>
    api.create(
      { balanceId: String(b.id), projectId: String(p.id), quantity },
      actor.id,
    );
  return {
    prisma,
    api,
    stock,
    reservations,
    issues,
    actor,
    projects,
    fixture,
    create,
    WarehouseReservationsApiService,
  };
}
