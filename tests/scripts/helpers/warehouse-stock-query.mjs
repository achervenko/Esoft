import assert from "node:assert/strict";

export async function verifyStockQuery(context, t) {
  const { namespace, stock, a, b, c, id, loc, receive, newItem } = context;
  await t.test(
    "reads filter combinations, stable paging and totals across locations",
    async () => {
      await receive(a, "20");
      await receive(b, "5");
      const second = await newItem("STOCK-B");
      await receive(c, "3.125", second);
      assert.equal(await stock.getItemTotal(id), "25");
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            itemId: id,
          })
        ).total,
        2,
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            itemIds: [id, second],
            locationIds: [loc(b), loc(c)],
          })
        ).total,
        2,
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            locationId: loc(a),
          })
        ).items[0].itemId,
        id,
      );
      assert.deepEqual(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            minQuantity: "5",
            maxQuantity: "20",
            sortBy: "quantity",
            sortOrder: "desc",
          })
        ).items.map((row) => row.quantity),
        ["20", "5"],
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            minQuantity: "100",
          })
        ).total,
        0,
      );
      const all = await stock.getBalances({
        warehouseId: String(a.warehouseId),
        sortBy: "location",
        sortOrder: "asc",
      });
      assert.deepEqual(
        all.items.map((row) => row.location.code),
        ["A", "B", "C"],
      );
      const page = await stock.getBalances({
        warehouseId: String(a.warehouseId),
        sortBy: "location",
        page: 2,
        limit: 1,
      });
      assert.equal(page.total, 3);
      assert.deepEqual(page.items, all.items.slice(1, 2));
      assert.deepEqual(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            sortBy: "item",
            sortOrder: "desc",
          })
        ).items.map((row) => row.item.article),
        [
          `${namespace}-STOCK-B`,
          `${namespace}-STOCK-A`,
          `${namespace}-STOCK-A`,
        ],
      );
    },
  );
}
