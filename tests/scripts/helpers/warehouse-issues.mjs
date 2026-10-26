import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};

export async function verifyWarehouseIssues(prisma) {
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
  const sheetQueries = new WarehouseIssueSheetsQueryService(prisma);
  const reservations = new WarehouseReservationsService(audit);
  const plans = new WarehouseIssuePlanService(stock, reservations);
  const access = new WarehouseIssuesAccessService();
  const service = new WarehouseIssuesService(
    prisma,
    audit,
    access,
    plans,
    stock,
    sheets,
    reservations,
  );
  const queries = new WarehouseIssuesQueryService(prisma);
  const admin = await prisma.user.create({
    data: {
      id: "issues-admin",
      name: "Admin",
      email: "issues-admin@test.invalid",
      role: "admin",
    },
  });
  const keeper = await prisma.user.create({
    data: {
      id: "issues-keeper",
      name: "Keeper",
      email: "issues-keeper@test.invalid",
      role: "storekeeper",
    },
  });
  const denied = await prisma.user.create({
    data: {
      id: "issues-denied",
      name: "Denied",
      email: "issues-denied@test.invalid",
      role: "accounting_specialist",
    },
  });
  const projects = await Promise.all(
    ["A", "B", "C"].map((projectNumber) =>
      prisma.warehouseProject.create({ data: { projectNumber } }),
    ),
  );
  let next = 0;
  async function fixture(physical = ["100"], reserves = []) {
    const n = ++next;
    const item = await prisma.warehouseItem.create({
      data: { article: "ISSUE-" + n, name: "Item " + n, unit: "шт" },
    });
    const balances = [];
    for (const [i, quantity] of physical.entries()) {
      const location = await prisma.warehouseStorageLocation.create({
        data: { code: `ISSUE-${n}-${i}`, name: "Shelf" },
      });
      const balance = await prisma.warehouseBalance.create({
        data: { itemId: item.id, storageLocationId: location.id, quantity },
      });
      for (const [projectIndex, amount] of (reserves[i] ?? []).entries())
        if (amount !== "0")
          await prisma.warehouseProjectReservation.create({
            data: {
              balanceId: balance.id,
              projectId: projects[projectIndex].id,
              quantity: amount,
            },
          });
      balances.push(balance);
    }
    return { item, balances };
  }
  const payload = (f, quantities, extra = {}) => ({
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
  const reserveQuantity = async (balanceId, projectId) =>
    (
      await prisma.warehouseProjectReservation.findUnique({
        where: { balanceId_projectId: { balanceId, projectId } },
      })
    )?.quantity.toString() ?? "0";
  const base = await fixture(["100"], [["50", "20"]]);
  for (const [projectId, available] of [
    [undefined, "30"],
    [String(projects[0].id), "80"],
    [String(projects[1].id), "50"],
  ]) {
    const row = (
      await queries.available({
        itemId: String(base.item.id),
        ...(projectId ? { projectId } : {}),
      })
    ).items[0];
    assert.equal(row.available, available);
    assert.equal(row.physical, "100");
    assert.equal(row.reserved, "70");
  }
  await assert.rejects(
    service.createIssue(payload(base, ["31"]), keeper.id),
    code("WAREHOUSE_ISSUE_RESERVED_STOCK"),
  );
  await assert.rejects(
    service.createIssue(payload(base, ["1"]), denied.id),
    code("FORBIDDEN"),
  );
  const manual = await service.createManualIssue(
    payload(base, ["25"]),
    keeper.id,
  );
  assert.equal(manual.type, "MANUAL");
  assert.equal(manual.issueSheetLineId, null);
  assert.equal(manual.issuedByUserId, keeper.id);
  assert.equal(
    await reserveQuantity(base.balances[0].id, projects[0].id),
    "50",
  );
  const own = await service.createIssue(
    payload(base, ["30"], { projectId: String(projects[0].id) }),
    keeper.id,
  );
  assert.equal(own.reservationUsage[0].quantity, "30");
  assert.equal(
    await reserveQuantity(base.balances[0].id, projects[0].id),
    "20",
  );
  assert.equal(await balanceQuantity(base.balances[0].id), "45");
  const multi = await fixture(
    ["100", "100"],
    [
      ["20", "30"],
      ["20", "30"],
    ],
  );
  const multiIssue = await service.createIssue(
    payload(multi, ["25", "25"], { projectId: String(projects[0].id) }),
    keeper.id,
  );
  assert.equal(multiIssue.positions.length, 2);
  assert.equal(multiIssue.totalQuantity, "50");
  for (const b of multi.balances) {
    assert.equal(await balanceQuantity(b.id), "75");
    assert.equal(await reserveQuantity(b.id, projects[0].id), "0");
    assert.equal(await reserveQuantity(b.id, projects[1].id), "30");
  }
  const other = await fixture();
  await assert.rejects(
    service.createIssue(
      {
        type: "MANUAL",
        positions: [
          { balanceId: String(multi.balances[0].id), quantity: "1" },
          { balanceId: String(other.balances[0].id), quantity: "1" },
        ],
      },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_MULTIPLE_ITEMS"),
  );
  const unavailable = await fixture(["10"], [["10"]]);
  assert.equal(
    (await queries.available({ itemId: String(unavailable.item.id) })).items
      .length,
    0,
  );
  assert.equal(
    (
      await queries.available({
        itemId: String(unavailable.item.id),
        includeUnavailable: true,
      })
    ).items[0].available,
    "0",
  );
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
      payload(other, ["101"], {
        overrideReservations: true,
        comment: "Причина",
      }),
      admin.id,
    ),
    code("WAREHOUSE_ISSUE_INSUFFICIENT_STOCK"),
  );
  const forSheet = await fixture(["20", "20"]);
  const sheet = await sheets.create({ name: "Задание" }, keeper.id);
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
    service.createIssue(sheetInput, keeper.id),
    code("WAREHOUSE_ISSUE_SHEET_OVERISSUED"),
  );
  const smallSheetInput = {
    ...sheetInput,
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
  const concurrent = await fixture(["10"]);
  const races = await Promise.allSettled([
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await balanceQuantity(concurrent.balances[0].id), "0");
  const atomic = await fixture(["10", "1"], [["5"], []]);
  const beforeCount = await prisma.warehouseIssue.count();
  await assert.rejects(
    service.createIssue(
      payload(atomic, ["2", "2"], { projectId: String(projects[0].id) }),
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_INSUFFICIENT_STOCK"),
  );
  assert.equal(await prisma.warehouseIssue.count(), beforeCount);
  assert.equal(await balanceQuantity(atomic.balances[0].id), "10");
  assert.equal(
    await reserveQuantity(atomic.balances[0].id, projects[0].id),
    "5",
  );
  const broken = new WarehouseIssuesService(
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
    reservations,
  );
  const beforeAudit = await prisma.auditLog.count();
  await assert.rejects(
    broken.createIssue(
      {
        type: "MANUAL",
        projectId: String(projects[0].id),
        positions: [
          { balanceId: String(atomic.balances[0].id), quantity: "2" },
        ],
      },
      keeper.id,
    ),
    /Issue audit unavailable/,
  );
  assert.equal(await prisma.warehouseIssue.count(), beforeCount);
  assert.equal(await prisma.auditLog.count(), beforeAudit);
  assert.equal(await balanceQuantity(atomic.balances[0].id), "10");
  assert.equal(
    await reserveQuantity(atomic.balances[0].id, projects[0].id),
    "5",
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
  assert.equal(
    (
      await queries.list({
        balanceId: String(multi.balances[0].id),
        locationId: String(multi.balances[0].storageLocationId),
        minQuantity: "25",
        maxQuantity: "25",
      })
    ).items[0].id,
    multiIssue.id,
  );
  assert.equal(
    (
      await queries.list({
        itemIds: [String(multi.item.id), String(other.item.id)],
        projectIds: [String(projects[0].id)],
        issuedByUserId: keeper.id,
        createdFrom: new Date(Date.now() - 60000),
        createdTo: new Date(),
        limit: 1,
      })
    ).items.length,
    1,
  );
  await prisma.user.update({
    where: { id: keeper.id },
    data: { banned: true },
  });
  await assert.rejects(
    service.createIssue(payload(other, ["1"]), keeper.id),
    code("FORBIDDEN"),
  );
}
