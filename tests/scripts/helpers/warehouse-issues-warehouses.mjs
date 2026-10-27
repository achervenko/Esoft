import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { code } from "./warehouse-issues-test-context.mjs";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);

export async function verifyWarehouseIssuesWarehouses(context) {
  const {
    prisma,
    warehouse,
    fixture,
    payload,
    service,
    queries,
    sheets,
    sheetQueries,
    stock,
    keeper,
    projects,
    balanceQuantity,
    audit,
    reservations,
  } = context;
  const { WarehouseStockQueryService } = load(
    "warehouse/stock/stock-query.service.js",
  );
  const { WarehouseReservationsApiService } = load(
    "warehouse/reservations/reservations-api.service.js",
  );
  const stockQueries = new WarehouseStockQueryService(prisma);
  const reserveApi = new WarehouseReservationsApiService(
    prisma,
    stock,
    reservations,
    audit,
  );
  const other = await prisma.warehouse.create({
    data: { code: warehouse.code + "-OTHER", name: "Другой склад" },
  });
  const f = await fixture(["20"]);
  const ownLocation = await prisma.warehouseStorageLocation.update({
    where: { id: f.balances[0].storageLocationId },
    data: { code: "A-01", name: "Полка" },
  });
  const foreignLocation = await prisma.warehouseStorageLocation.create({
    data: { warehouseId: other.id, code: "A-01", name: "Полка" },
  });
  const foreignBalance = await prisma.warehouseBalance.create({
    data: {
      itemId: f.item.id,
      storageLocationId: foreignLocation.id,
      quantity: "30",
    },
  });
  const a = String(warehouse.id),
    b = String(other.id),
    itemId = String(f.item.id);
  const crossInput = payload({ balances: [f.balances[0], foreignBalance] }, [
    "1",
    "1",
  ]);
  const before = await prisma.warehouseIssue.count();
  await assert.rejects(
    service.createIssue(crossInput, keeper.id),
    code("WAREHOUSE_ISSUE_MULTIPLE_WAREHOUSES"),
  );
  assert.equal(await prisma.warehouseIssue.count(), before);
  assert.equal(await balanceQuantity(f.balances[0].id), "20");
  assert.equal(await balanceQuantity(foreignBalance.id), "30");
  const all = await queries.available({ itemId });
  assert.equal(all.items.length, 2);
  assert.deepEqual(
    new Set(all.items.map((row) => row.location.warehouseId)),
    new Set([a, b]),
  );
  assert.equal(
    all.items.every((row) => row.location.code === "A-01"),
    true,
  );
  for (const [warehouseId, locationId, quantity] of [
    [a, String(ownLocation.id), "20"],
    [b, String(foreignLocation.id), "30"],
  ]) {
    const available = await queries.available({ itemId, warehouseId });
    assert.equal(available.items.length, 1);
    assert.equal(available.items[0].location.id, locationId);
    assert.equal(available.items[0].location.warehouse.id, warehouseId);
    assert.equal(available.items[0].physical, quantity);
    const physical = await stock.getBalances({ itemId, warehouseId });
    assert.equal(physical.total, 1);
    assert.equal(physical.items[0].location.warehouseId, warehouseId);
    assert.equal(
      await stockQueries.getItemTotal(itemId, warehouseId),
      quantity,
    );
  }
  assert.equal(await stockQueries.getItemTotal(itemId), "50");
  assert.equal(
    (
      await stock.getBalances({
        itemId,
        warehouseId: a,
        locationId: String(foreignLocation.id),
      })
    ).total,
    0,
  );
  const projectId = String(projects[0].id);
  const reservation = await reserveApi.create(
    { balanceId: String(foreignBalance.id), projectId, quantity: "2" },
    keeper.id,
  );
  assert.equal(reservation.location.warehouse.id, b);
  assert.equal((await reserveApi.list({ warehouseId: a, itemId })).total, 0);
  assert.equal(
    (await reserveApi.list({ warehouseId: b, itemId })).items[0].id,
    reservation.id,
  );
  assert.equal(
    (
      await reserveApi.list({
        warehouseId: a,
        locationId: String(foreignLocation.id),
      })
    ).total,
    0,
  );
  const ownIssue = await service.createIssue(payload(f, ["1"]), keeper.id);
  const foreignIssue = await service.createIssue(
    payload({ balances: [foreignBalance] }, ["1"]),
    keeper.id,
  );
  assert.equal(ownIssue.warehouseId, a);
  assert.equal(foreignIssue.warehouse.id, b);
  assert.equal(
    (await queries.get(foreignIssue.id)).positions[0].location.warehouseId,
    b,
  );
  assert.equal(
    (await queries.list({ warehouseId: a, itemId })).items[0].id,
    ownIssue.id,
  );
  assert.equal(
    (await queries.list({ warehouseId: b, itemId })).items[0].id,
    foreignIssue.id,
  );
  assert.equal(
    (
      await queries.list({
        warehouseId: a,
        locationId: String(foreignLocation.id),
      })
    ).total,
    0,
  );
  const sheet = await sheets.create(
    { warehouseId: a, name: "По одному складу" },
    keeper.id,
  );
  assert.equal(sheet.warehouseId, a);
  await assert.rejects(
    sheets.addLine(
      sheet.id,
      {
        rowNumber: 1,
        itemId,
        storageLocationId: String(foreignLocation.id),
        quantity: "5",
        matchingStatus: "MATCHED",
      },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_SHEET_LOCATION_MISMATCH"),
  );
  const line = await sheets.addLine(
    sheet.id,
    {
      rowNumber: 1,
      itemId,
      storageLocationId: String(ownLocation.id),
      quantity: "5",
      matchingStatus: "MATCHED",
    },
    keeper.id,
  );
  await assert.rejects(
    sheets.updateLine(
      sheet.id,
      line.id,
      { storageLocationId: String(foreignLocation.id) },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_SHEET_LOCATION_MISMATCH"),
  );
  await sheets.markReady(sheet.id, keeper.id);
  assert.equal((await sheetQueries.list({ warehouseId: a })).total, 1);
  assert.equal((await sheetQueries.list({ warehouseId: b })).total, 0);
  const foreignSheetInput = payload({ balances: [foreignBalance] }, ["1"], {
    type: "ISSUE_SHEET",
    issueSheetLineId: line.id,
  });
  await assert.rejects(
    service.createIssueFromSheet(foreignSheetInput, keeper.id),
    code("WAREHOUSE_ISSUE_SHEET_WAREHOUSE_MISMATCH"),
  );
  const issued = await service.createIssueFromSheet(
    payload(f, ["1"], { type: "ISSUE_SHEET", issueSheetLineId: line.id }),
    keeper.id,
  );
  assert.equal(issued.warehouseId, a);
  assert.equal(
    (await sheetQueries.lines(sheet.id, {})).items[0].issuedQuantity,
    "1",
  );
}
