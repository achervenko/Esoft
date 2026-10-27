import assert from "node:assert/strict";

export async function verifyStockActivity(context, t) {
  const { prisma, namespace, stock, a, b, c, loc, receive, issue, move, read } =
    context;
  await t.test(
    "activity is a caller policy; Stock neither activates nor blocks inactive records",
    async () => {
      const inactive = await prisma.warehouseItem.create({
        data: {
          article: `${namespace}-INACTIVE`,
          name: "Inactive",
          unit: "шт",
          isActive: false,
        },
      });
      await prisma.warehouseStorageLocation.update({
        where: { id: c.id },
        data: { isActive: false },
      });
      const inactiveId = inactive.id.toString();
      await receive(c, "2", inactiveId);
      await issue(c, "0.5", inactiveId);
      await move(c, b, "0.5", inactiveId);
      assert.equal((await read(c, inactiveId)).item.isActive, false);
      assert.equal((await read(c, inactiveId)).location.isActive, false);
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            itemActive: false,
          })
        ).total,
        2,
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            itemActive: false,
            locationActive: true,
          })
        ).items[0].locationId,
        loc(b),
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            locationActive: false,
          })
        ).items.every((row) => !row.location.isActive),
        true,
      );
    },
  );
}
