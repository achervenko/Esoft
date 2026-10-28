import assert from "node:assert/strict";
export async function verifyWarehouseSchemaConstraints({
  prisma,
  database,
  item,
  location,
  projectRow,
  balance,
  reservation,
  line,
}) {
  await assert.rejects(
    prisma.warehouseItem.create({
      data: { article: item.article, name: "Duplicate", unit: "шт" },
    }),
    { code: "P2002" },
  );
  await assert.rejects(
    prisma.warehouseStorageLocation.create({
      data: {
        warehouse: {
          connectOrCreate: {
            where: { name: "TEST" },
            create: { name: "TEST" },
          },
        },

        name: location.name,
      },
    }),
    { code: "P2002" },
  );
  await assert.rejects(
    prisma.warehouseProject.create({
      data: { projectNumber: projectRow.projectNumber },
    }),
    { code: "P2002" },
  );
  await assert.rejects(
    prisma.warehouseBalance.create({
      data: { itemId: item.id, storageLocationId: location.id },
    }),
    { code: "P2002" },
  );
  await assert.rejects(
    prisma.warehouseProjectReservation.create({
      data: { balanceId: balance.id, projectId: projectRow.id, quantity: "1" },
    }),
    { code: "P2002" },
  );
  await assert.rejects(
    prisma.warehouseBalance.create({
      data: { itemId: -1n, storageLocationId: location.id },
    }),
    { code: "P2003" },
  );
  for (const [table, id, rejected] of [
    ["warehouse_balances", balance.id, ["-0.001"]],
    ["warehouse_project_reservations", reservation.id, ["0", "-0.001"]],
    ["warehouse_issue_sheet_lines", line.id, ["0", "-0.001"]],
  ]) {
    for (const quantity of rejected) {
      await assert.rejects(
        database.query(`UPDATE "${table}" SET quantity=$1 WHERE id=$2`, [
          quantity,
          id.toString(),
        ]),
        { code: "23514" },
      );
    }
  }
  await prisma.warehouseProjectReservation.delete({
    where: { id: reservation.id },
  });
  await prisma.warehouseBalance.update({
    where: { id: balance.id },
    data: { quantity: "0" },
  });
  await assert.rejects(
    database.query(
      "INSERT INTO warehouse_project_reservations(balance_id, project_id) VALUES ($1, $2)",
      [balance.id.toString(), projectRow.id.toString()],
    ),
    { code: "23502" },
  );
}
