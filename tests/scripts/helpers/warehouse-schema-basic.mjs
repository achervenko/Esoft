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
    data: { code: "A-1", name: "Shelf" },
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
  const projectRow = await prisma.warehouseProject.create({
    data: { projectNumber: "PROJECT-1" },
  });
  assert.equal(projectRow.name, null);
  assert.equal(projectRow.isActive, true);
  const balance = await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: location.id },
  });
  assert.equal(balance.quantity.toString(), "0");
  await prisma.warehouseBalance.update({
    where: { id: balance.id },
    data: { quantity: "12345678901.123" },
  });
  const reservation = await prisma.warehouseProjectReservation.create({
    data: {
      balanceId: balance.id,
      projectId: projectRow.id,
      quantity: "0.125",
    },
  });
  assert.equal(reservation.quantity.toString(), "0.125");
  await prisma.warehouseProject.update({
    where: { id: projectRow.id },
    data: { isActive: false },
  });
  const closedProject = await prisma.warehouseProject.findUniqueOrThrow({
    where: { id: projectRow.id },
    include: { reservations: true },
  });
  assert.equal(closedProject.isActive, false);
  assert.equal(closedProject.reservations[0].id, reservation.id);
  assert.equal(
    (
      await prisma.warehouseBalance.findUniqueOrThrow({
        where: { id: balance.id },
      })
    ).quantity.toString(),
    "12345678901.123",
  );
  return { item, location, projectRow, balance, reservation };
}
