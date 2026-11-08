import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
export const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};

export async function createWarehouseIssuesTestContext(prisma) {
  const namespace = "issues-" + randomUUID();
  const warehouse = await prisma.warehouse.create({
    data: { name: namespace },
  });
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
  const { WarehouseIssueSheetsQueryService } = load(
    "warehouse/issue-sheets/issue-sheets-query.service.js",
  );
  const { WarehouseIssuesService } = load("warehouse/issues/issues.service.js");
  const { WarehouseIssuesQueryService } = load(
    "warehouse/issues/issues-query.service.js",
  );
  const { WarehouseIssuesAccessService } = load(
    "warehouse/issues/issues-access.service.js",
  );
  const { WarehouseIssuePlanService } = load(
    "warehouse/issues/issues-plan.service.js",
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
  const sheetQueries = new WarehouseIssueSheetsQueryService(prisma);
  const plans = new WarehouseIssuePlanService(stock);
  const access = new WarehouseIssuesAccessService();
  const service = new WarehouseIssuesService(
    prisma,
    audit,
    access,
    plans,
    stock,
    sheets,
  );
  const queries = new WarehouseIssuesQueryService(prisma);
  const admin = await prisma.user.create({
    data: {
      id: `${namespace}-admin`,
      name: "Admin",
      email: `${namespace}-admin@test.invalid`,
      role: "admin",
    },
  });
  const keeper = await prisma.user.create({
    data: {
      id: `${namespace}-keeper`,
      name: "Keeper",
      email: `${namespace}-keeper@test.invalid`,
      role: "storekeeper",
    },
  });
  const denied = await prisma.user.create({
    data: {
      id: `${namespace}-denied`,
      name: "Denied",
      email: `${namespace}-denied@test.invalid`,
      role: "accounting_specialist",
    },
  });
  let next = 0;
  async function fixture(physical = ["100"]) {
    const n = ++next;
    const item = await prisma.warehouseItem.create({
      data: { article: `${namespace}-${n}`, name: "Item " + n, unit: "шт" },
    });
    const balances = [];
    for (const [i, quantity] of physical.entries()) {
      const location = await prisma.warehouseStorageLocation.create({
        data: {
          warehouseId: warehouse.id,

          name: `Shelf ${namespace}-${n}-${i}`,
        },
      });
      const balance = await prisma.warehouseBalance.create({
        data: { itemId: item.id, storageLocationId: location.id, quantity },
      });
      balances.push(balance);
    }
    return { item, balances };
  }
  const payload = (f, quantities, extra = {}) => ({
    requestKey: randomUUID(),
    type: "MANUAL",
    positions: f.balances.map((b, i) => ({
      balanceId: String(b.id),
      quantity: quantities[i],
    })),
    ...extra,
  });
  const balanceQuantity = async (id) =>
    (
      await prisma.warehouseBalance.findUniqueOrThrow({ where: { id } })
    ).quantity.toString();
  function createBrokenService() {
    return new WarehouseIssuesService(
      prisma,
      {
        writeFieldChanges: async () => {
          throw new Error("Issue audit unavailable");
        },
      },
      access,
      plans,
      stock,
      sheets,
    );
  }
  return {
    prisma,
    audit,
    warehouse,
    service,
    queries,
    stock,
    sheets,
    sheetQueries,
    admin,
    keeper,
    denied,
    fixture,
    payload,
    balanceQuantity,
    createBrokenService,
  };
}
