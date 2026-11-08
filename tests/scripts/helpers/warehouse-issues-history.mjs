import assert from "node:assert/strict";
const json = (value) => JSON.parse(JSON.stringify(value));
export async function verifyWarehouseIssuesHistory(context) {
  const {
    prisma,
    warehouse,
    fixture,
    payload,
    service,
    queries,
    keeper,
    sheets,
  } = context;
  const f = await fixture(["20", "10"]);
  const oldArticle = "Кабель%_\\-2025";
  await prisma.warehouseItem.update({
    where: { id: f.item.id },
    data: { article: oldArticle, name: "Исторический кабель", unit: "м" },
  });
  await prisma.user.update({
    where: { id: keeper.id },
    data: { name: "Первоначальный кладовщик" },
  });
  await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: { name: "Исторический склад" },
  });
  const sheet = await sheets.create(
    { warehouseId: String(warehouse.id), name: "Исторический лист" },
    keeper.id,
  );
  const line = await sheets.addLine(
    sheet.id,
    {
      itemId: String(f.item.id),
      quantity: "5",
      matchingStatus: "MATCHED",
      rowNumber: 7,
    },
    keeper.id,
  );
  await sheets.markReady(sheet.id, keeper.id);
  const input = payload(f, ["3", "2"], {
    type: "ISSUE_SHEET",
    issueSheetLineId: line.id,
  });
  const issued = await service.createIssue(input, keeper.id);
  assert.equal(issued.positions[0].item.article, oldArticle);
  assert.equal(issued.positions[0].item.unit, "м");
  assert.equal(issued.issuedBy.name, "Первоначальный кладовщик");
  assert.deepEqual(issued.issueSheet, {
    id: sheet.id,
    name: "Исторический лист",
    rowNumber: 7,
  });
  assert.deepEqual(json(await queries.get(issued.id)), issued);
  assert.deepEqual(
    json((await queries.list({ itemId: String(f.item.id) })).items[0]),
    issued,
  );
  await sheets.finalize(sheet.id, keeper.id);
  await prisma.warehouseItem.update({
    where: { id: f.item.id },
    data: { article: "NEW-ARTICLE", name: "Новое имя товара", isActive: false },
  });
  for (const balance of f.balances)
    await prisma.warehouseStorageLocation.update({
      where: { id: balance.storageLocationId },
      data: {
        name: "Новое место " + String(balance.id),
        isActive: false,
      },
    });
  await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: {
      name: "Новый склад",
      isActive: false,
    },
  });
  await prisma.user.update({
    where: { id: keeper.id },
    data: { name: "Новое имя кладовщика" },
  });
  await prisma.warehouseIssueSheet.update({
    where: { id: BigInt(sheet.id) },
    data: { name: "Переименованный лист" },
  });
  assert.deepEqual(json(await queries.get(issued.id)), issued);
  assert.deepEqual(await service.createIssue(input, keeper.id), issued);
  for (const search of [
    oldArticle.toUpperCase(),
    "исторический кабель",
    "Первоначальный кладовщик",
    "Исторический склад",
    "Исторический лист",
    issued.positions[0].location.name,
    "%_\\",
  ]) {
    const found = await queries.list({
      warehouseId: String(warehouse.id),
      search,
    });
    assert.equal(found.total, 1, search);
    assert.equal(found.items[0].id, issued.id);
  }
  for (const search of ["NEW-ARTICLE", "Новый склад", "Переименованный лист"])
    assert.equal(
      (await queries.list({ warehouseId: String(warehouse.id), search })).total,
      0,
      search,
    );
  // History must survive retention of technical requests and audit logs.
  await prisma.warehouseIssueRequest.deleteMany({
    where: { issueId: BigInt(issued.id) },
  });
  await prisma.auditLog.deleteMany({
    where: { entityType: "warehouse_issue", entityStringId: issued.id },
  });
  assert.deepEqual(json(await queries.get(issued.id)), issued);
  assert.deepEqual(
    json(
      (
        await queries.list({
          warehouseId: String(warehouse.id),
          search: oldArticle,
        })
      ).items[0],
    ),
    issued,
  );
  // Date lookup operates on issue.createdAt, including genuinely old records.
  await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: { isActive: true },
  });
  const historical = await fixture(["10"]);
  const old = await service.createIssue(payload(historical, ["1"]), keeper.id);
  const recent = await service.createIssue(
    payload(historical, ["2"]),
    keeper.id,
  );
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  await prisma.warehouseIssue.update({
    where: { id: BigInt(old.id) },
    data: { createdAt: yearAgo },
  });
  const found = await queries.list({
    warehouseId: String(warehouse.id),
    itemId: String(historical.item.id),
    createdFrom: new Date(yearAgo.getTime() - 1000),
    createdTo: new Date(yearAgo.getTime() + 1000),
  });
  assert.equal(found.total, 1);
  assert.equal(found.items[0].id, old.id);
  assert.equal(
    found.items.some((row) => row.id === recent.id),
    false,
  );
  const page1 = await queries.list({
    itemId: String(historical.item.id),
    sortOrder: "asc",
    limit: 1,
    page: 1,
  });
  const page2 = await queries.list({
    itemId: String(historical.item.id),
    sortOrder: "asc",
    limit: 1,
    page: 2,
  });
  assert.equal(page1.total, 2);
  assert.equal(page2.total, 2);
  assert.equal(page1.items[0].id, old.id);
  assert.equal(page2.items[0].id, recent.id);
}
