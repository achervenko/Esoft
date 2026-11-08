import assert from "node:assert/strict";
export async function verifyWarehouseSchemaConstraints({
  prisma,
  database,
  item,
  location,
  balance,
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
    prisma.warehouseBalance.create({
      data: { itemId: item.id, storageLocationId: location.id },
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
}
