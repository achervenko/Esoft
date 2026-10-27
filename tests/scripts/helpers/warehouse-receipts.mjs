import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};
export async function verifyReceipts(prisma, database) {
  const { WarehouseReceiptsService } = load(
    "warehouse/receipts/receipts.service.js",
  );
  const { WarehouseReceiptsQueryService } = load(
    "warehouse/receipts/receipts-query.service.js",
  );
  const { WarehouseStockService } = load("warehouse/stock/stock.service.js");
  const { WarehouseStockQueryService } = load(
    "warehouse/stock/stock-query.service.js",
  );
  const { AuditLogService } = load("audit/audit-log.service.js");
  const audit = new AuditLogService(prisma),
    stock = new WarehouseStockService(
      new WarehouseStockQueryService(prisma),
      audit,
    );
  const service = new WarehouseReceiptsService(prisma, stock, audit),
    query = new WarehouseReceiptsQueryService(prisma);
  const actor = await prisma.user.create({
    data: {
      id: "receipt-keeper",
      name: "Keeper",
      email: "receipt@test.invalid",
      role: "storekeeper",
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: { id: 9007199254740993n, code: "RECEIPTS", name: "Приходы" },
  });
  const other = await prisma.warehouse.create({
    data: { code: "OTHER", name: "Другой" },
  });
  const locations = await Promise.all(
    ["A", "B", "C"].map((code) =>
      prisma.warehouseStorageLocation.create({
        data: { warehouseId: warehouse.id, code, name: "Место " + code },
      }),
    ),
  );
  const foreign = await prisma.warehouseStorageLocation.create({
    data: { warehouseId: other.id, code: "A", name: "Чужое место" },
  });
  const items = await Promise.all(
    ["A", "B", "C"].map((article) =>
      prisma.warehouseItem.create({
        data: { article, name: "Товар " + article, unit: "шт" },
      }),
    ),
  );
  const line = (i, l, q = "1") => ({
    itemId: String(items[i].id),
    storageLocationId: String(locations[l].id),
    quantity: q,
  });
  const payload = (lines) => ({
    warehouseId: String(warehouse.id),
    requestKey: randomUUID(),
    documentNumber: " 42% ",
    documentDate: "2024-02-29",
    lines,
  });
  const original = payload([
    line(1, 1, "3.125"),
    line(0, 0, "2"),
    line(0, 1, "1"),
  ]);
  const first = await service.createManual(original, actor.id);
  assert.equal(first.warehouseId, String(warehouse.id));
  assert.equal(first.source, "MANUAL");
  assert.equal(first.documentNumber, "42%");
  assert.equal(first.documentDate, "2024-02-29");
  assert.deepEqual(
    first.lines.map((l) => l.itemId),
    original.lines.map((l) => l.itemId),
  );
  assert.equal(
    (await stock.getBalance(String(items[0].id), String(locations[0].id)))
      .quantity,
    "2",
  );
  const repeated = await service.createManual(
    {
      ...original,
      documentNumber: "42%",
      lines: [...original.lines].reverse().map((l) => ({
        ...l,
        quantity: l.quantity === "2" ? "2.000" : l.quantity,
      })),
    },
    actor.id,
  );
  assert.deepEqual(repeated, first);
  await assert.rejects(
    service.createManual({ ...original, comment: "changed" }, actor.id),
    code("WAREHOUSE_RECEIPT_REQUEST_CONFLICT"),
  );
  const before = await prisma.warehouseReceipt.count();
  const concurrentPayload = payload([line(2, 2, "2")]);
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, () =>
      service.createManual(concurrentPayload, actor.id),
    ),
  );
  assert.equal(new Set(concurrent.map((r) => r.id)).size, 1);
  assert.equal(await prisma.warehouseReceipt.count(), before + 1);
  assert.equal(
    (await stock.getBalance(String(items[2].id), String(locations[2].id)))
      .quantity,
    "2",
  );
  // Common source entry point and database-enforced identity.
  const { requestKey, ...common } = payload([line(2, 2)]);
  const external = await service.post(
    common,
    { source: "ONE_C", sourceSystem: "BASE-A", sourceOperationId: "DOC-1" },
    actor.id,
  );
  assert.equal(external.source, "ONE_C");
  await service.post(
    common,
    { source: "ONE_C", sourceSystem: "BASE-B", sourceOperationId: "DOC-1" },
    actor.id,
  );
  const stored = await prisma.warehouseReceipt.findUniqueOrThrow({
    where: { id: BigInt(external.id) },
  });
  const { id, ...copy } = stored;
  await assert.rejects(prisma.warehouseReceipt.create({ data: copy }), {
    code: "P2002",
  });
  // Same-line EXISTS: A at location C does not occur, though each exists on separate rows.
  const cross = payload([line(0, 0), line(1, 2)]);
  const crossReceipt = await service.createManual(cross, actor.id);
  const filter = {
    itemId: String(items[0].id),
    storageLocationId: String(locations[2].id),
  };
  assert.equal((await query.list(filter)).total, 0);
  assert.ok(
    (
      await query.list({
        itemId: String(items[0].id),
        storageLocationId: String(locations[0].id),
      })
    ).total > 0,
  );
  assert.equal(
    (await query.list({ search: "%" })).total,
    await prisma.warehouseReceipt.count(),
  );
  assert.equal((await query.list({ source: "ONE_C" })).total, 2);
  assert.equal((await query.list({ page: "2", limit: "1" })).items.length, 1);
  assert.equal(
    (await query.list({ createdFrom: "2099-01-01T00:00:00Z" })).total,
    0,
  );
  // Roll back after an earlier line has already increased stock.
  await stockReceive(
    stock,
    prisma,
    actor.id,
    items[2].id,
    locations[0].id,
    "99999999999.999",
  );
  const balanceBefore = (
    await stock.getBalance(String(items[0].id), String(locations[0].id))
  ).quantity;
  const docsBefore = await prisma.warehouseReceipt.count();
  await assert.rejects(
    service.createManual(payload([line(0, 0), line(2, 0)]), actor.id),
    code("WAREHOUSE_STOCK_QUANTITY_OVERFLOW"),
  );
  assert.equal(
    (await stock.getBalance(String(items[0].id), String(locations[0].id)))
      .quantity,
    balanceBefore,
  );
  assert.equal(await prisma.warehouseReceipt.count(), docsBefore);
  const failing = new WarehouseReceiptsService(prisma, stock, {
    writeFieldChanges: async () => {
      throw new Error("audit unavailable");
    },
  });
  await assert.rejects(
    failing.createManual(payload([line(0, 0)]), actor.id),
    /audit unavailable/,
  );
  assert.equal(
    (await stock.getBalance(String(items[0].id), String(locations[0].id)))
      .quantity,
    balanceBefore,
  );
  assert.equal(await prisma.warehouseReceipt.count(), docsBefore);
  await assert.rejects(
    service.createManual(
      payload([{ ...line(0, 0), storageLocationId: String(foreign.id) }]),
      actor.id,
    ),
    code("WAREHOUSE_RECEIPT_LOCATION_MISMATCH"),
  );
  const missingId = "9223372036854775807";
  await assert.rejects(
    service.createManual(
      payload([{ ...line(0, 0), itemId: missingId }]),
      actor.id,
    ),
    code("WAREHOUSE_ITEM_NOT_FOUND"),
  );
  await assert.rejects(
    service.createManual(
      payload([{ ...line(0, 0), storageLocationId: missingId }]),
      actor.id,
    ),
    code("WAREHOUSE_LOCATION_NOT_FOUND"),
  );
  assert.equal(await prisma.warehouseReceipt.count(), docsBefore);
  // Historical snapshots survive renames and successful replay survives deactivation.
  await prisma.warehouseItem.update({
    where: { id: items[0].id },
    data: { name: "Переименовано", article: "NEW-A", isActive: false },
  });
  await prisma.warehouseStorageLocation.update({
    where: { id: locations[0].id },
    data: { name: "Новое место", code: "NEW-A", isActive: false },
  });
  await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: { name: "Новый склад", isActive: false },
  });
  assert.deepEqual(await service.createManual(original, actor.id), first);
  assert.deepEqual(await service.findOne(first.id), first);
  await assert.rejects(
    service.createManual(payload([line(0, 0)]), actor.id),
    code("WAREHOUSE_INACTIVE"),
  );
  await prisma.warehouse.update({
    where: { id: warehouse.id },
    data: { isActive: true },
  });
  await assert.rejects(
    service.createManual(payload([line(0, 0)]), actor.id),
    code("WAREHOUSE_RECEIPT_INACTIVE_REFERENCE"),
  );
  await prisma.warehouseItem.update({
    where: { id: items[0].id },
    data: { isActive: true },
  });
  await prisma.warehouseStorageLocation.update({
    where: { id: locations[0].id },
    data: { isActive: true },
  });
  // Opposite input order and concurrent Stock issue cannot deadlock or lose increments.
  await Promise.all([
    service.createManual(payload([line(1, 1, "5"), line(0, 0, "5")]), actor.id),
    service.createManual(payload([line(0, 0, "5"), line(1, 1, "5")]), actor.id),
    prisma.$transaction((tx) =>
      stock.issueStock(
        { tx, actorUserId: actor.id },
        String(items[0].id),
        String(locations[0].id),
        "1",
      ),
    ),
  ]);
  assert.equal(
    (await stock.getBalance(String(items[0].id), String(locations[0].id)))
      .quantity,
    String(Number(balanceBefore) + 9),
  );
  const auditRows = await prisma.auditLog.count({
    where: { entityType: "warehouse_receipt", entityStringId: first.id },
  });
  assert.ok(auditRows > 0);
  await assert.rejects(
    database.query(
      "UPDATE warehouse_receipt_lines SET quantity=0 WHERE receipt_id=$1",
      [first.id],
    ),
    { code: "23514" },
  );
  await assert.rejects(
    database.query("UPDATE warehouse_receipts SET source=$1 WHERE id=$2", [
      "BAD",
      first.id,
    ]),
    { code: "23514" },
  );
  await prisma.user.update({ where: { id: actor.id }, data: { banned: true } });
  await assert.rejects(
    service.createManual(original, actor.id),
    (e) => e.status === 403,
  );
  await prisma.user.update({
    where: { id: actor.id },
    data: { banned: false, role: "operator" },
  });
  await assert.rejects(
    service.createManual(payload([line(0, 0)]), actor.id),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.findOne("9223372036854775807"),
    code("WAREHOUSE_RECEIPT_NOT_FOUND"),
  );
  assert.ok(crossReceipt.id);
}
async function stockReceive(
  stock,
  prisma,
  actorUserId,
  item,
  location,
  quantity,
) {
  return prisma.$transaction((tx) =>
    stock.receiveStock(
      { tx, actorUserId },
      String(item),
      String(location),
      quantity,
    ),
  );
}
