import assert from "node:assert/strict";
export async function verifyWarehouseSchemaBasic({ prisma }) {
  const item = await prisma.warehouseItem.create({
    data: {
      id: 9007199254740993n,
      article: "WH-1",
      name: "Warehouse item",
      unit: "шт",
    },
  });
  assert.equal(item.id, 9007199254740993n);
  assert.equal(item.isActive, true);
  const location = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { name: "TEST" },
          create: { name: "TEST" },
        },
      },

      name: "Shelf",
    },
  });
  assert.equal(location.isActive, true);
  await prisma.warehouseStorageLocation.update({
    where: { id: location.id },
    data: { isActive: false },
  });
  assert.equal(
    (
      await prisma.warehouseStorageLocation.findUniqueOrThrow({
        where: { id: location.id },
      })
    ).isActive,
    false,
  );
  const balance = await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: location.id },
  });
  assert.equal(balance.quantity.toString(), "0");
  await prisma.warehouseBalance.update({
    where: { id: balance.id },
    data: { quantity: "12345678901.123" },
  });
  assert.equal(
    (
      await prisma.warehouseBalance.findUniqueOrThrow({
        where: { id: balance.id },
      })
    ).quantity.toString(),
    "12345678901.123",
  );
  return { item, location, balance };
}
