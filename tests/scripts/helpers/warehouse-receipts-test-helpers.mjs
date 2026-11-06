import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};
export async function createReceiptTestHelpers(prisma, domain) {
  const {
    namespace,
    warehouse,
    admin,
    item,
    location,
    keeper,
    receipts,
    placements,
    importer,
    itemMapping,
  } = domain;
  const manual = (quantity = "10", patch = {}) =>
    receipts.createManual(
      {
        warehouseId: String(warehouse.id),
        requestKey: randomUUID(),
        lines: [{ itemId: String(item.id), quantity }],
        ...patch,
      },
      keeper.id,
    );
  const placement = (
    quantity = "1",
    place = location.id,
    key = randomUUID(),
  ) => ({ quantity, storageLocationId: String(place), requestKey: key });
  const place = (r, quantity = "1", where = location.id, key = randomUUID()) =>
    placements.place(
      r.id,
      r.lines[0].id,
      placement(quantity, where, key),
      keeper.id,
    );
  const quantity = async () => {
    const r = await prisma.warehouseBalance.aggregate({
      _sum: { quantity: true },
      where: { itemId: item.id },
    });
    return r._sum.quantity?.toString() ?? "0";
  };
  const source = (patch = {}) => ({
    id: randomUUID(),
    number: "125",
    date: "2026-10-29",
    version: "1",
    status: "POSTED",
    warehouse: { id: namespace + "external-wh", name: "External warehouse" },
    lines: [
      {
        id: "line-1",
        item: {
          id: namespace + "external-item",
          article: " 6204 ",
          name: " Bearing ",
          unit: "шт",
          type: "GOODS",
        },
        quantity: "10",
        order: { id: namespace + "order", number: "123", name: "Order" },
      },
    ],
    ...patch,
  });
  const sourceSystem = namespace;
  await prisma.warehouseExternalWarehouse.create({
    data: {
      sourceSystem,
      externalId: source().warehouse.id,
      warehouseId: warehouse.id,
      confirmedBy: admin.id,
    },
  });
  const ingest = (doc) =>
    prisma.$transaction(
      (tx) => importer.apply(tx, sourceSystem, doc, admin.id),
      { timeout: 20000 },
    );
  const mapped = async (doc = source()) => {
    const r = await ingest(doc);
    await itemMapping.mapItem(
      r.id,
      r.lines[0].id,
      { itemId: String(item.id) },
      keeper.id,
    );
    return receipts.findOne(r.id);
  };
  return {
    manual,
    placement,
    place,
    quantity,
    source,
    sourceSystem,
    ingest,
    mapped,
  };
}
