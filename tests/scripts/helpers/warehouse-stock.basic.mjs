import assert from "node:assert/strict";

export async function verifyStockBasic(context, t) {
  const { Prisma, stock, a, b, c, id, loc, receive, issue, move, read } =
    context;
  await t.test(
    "absence differs from a stored zero and quantities/IDs stay exact",
    async () => {
      assert.equal(await read(a), null);
      assert.equal(await stock.getItemTotal(id), "0");
      const received = await receive(a, new Prisma.Decimal("20.125"));
      assert.equal(received.quantity, "20.125");
      assert.equal(received.itemId, id);
      assert.equal(received.locationId, loc(a));
      assert.doesNotThrow(() => JSON.stringify(received));
      assert.equal((await receive(a, "0.875")).quantity, "21");
      await issue(a, "21");
      const zero = await read(a);
      assert.equal(zero.id, received.id);
      assert.equal(zero.quantity, "0");
      assert.equal(
        (await stock.getBalances({ warehouseId: String(a.warehouseId) })).items
          .length,
        0,
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            quantityState: "ZERO",
          })
        ).items[0].id,
        zero.id,
      );
      assert.equal(
        (
          await stock.getBalances({
            warehouseId: String(a.warehouseId),
            quantityState: "ALL",
          })
        ).total,
        1,
      );
    },
  );

  await t.test(
    "movement conserves total, creates destinations and retains zero sources",
    async () => {
      await receive(a, "20");
      await receive(b, "5");
      const result = await move(a, b, "8");
      assert.equal(result.from.quantity, "12");
      assert.equal(result.to.quantity, "13");
      await move(a, c, "12");
      assert.equal((await read(a)).quantity, "0");
      assert.equal((await read(c)).quantity, "12");
      assert.equal(await stock.getItemTotal(id), "25");
    },
  );
}
