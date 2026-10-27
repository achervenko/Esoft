import assert from "node:assert/strict";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyStockErrors(context, t) {
  const {
    prisma,
    actor,
    stock,
    a,
    b,
    id,
    loc,
    receive,
    issue,
    move,
    read,
    newItem,
  } = context;
  await t.test(
    "operation errors are stable and never create a destination on failure",
    async () => {
      await receive(a, "1");
      await issue(a, "1");
      await assert.rejects(
        issue(a, "1"),
        hasCode("WAREHOUSE_STOCK_INSUFFICIENT", 409),
      );
      await assert.rejects(move(a, b, "1"), (error) => {
        assert.deepEqual(error.response.details, {
          itemId: id,
          locationId: loc(a),
          requested: "1",
          available: "0",
        });
        return hasCode("WAREHOUSE_STOCK_INSUFFICIENT", 409)(error);
      });
      await assert.rejects(
        move(b, b, "1"),
        hasCode("WAREHOUSE_STOCK_SAME_LOCATION", 400),
      );
      await assert.rejects(
        receive(a, "1", "9223372036854775807"),
        hasCode("WAREHOUSE_ITEM_NOT_FOUND", 404),
      );
      await assert.rejects(
        stock.getItemTotal("9223372036854775807"),
        hasCode("WAREHOUSE_ITEM_NOT_FOUND", 404),
      );
      await assert.rejects(
        receive({ id: 9223372036854775807n }, "1"),
        hasCode("WAREHOUSE_LOCATION_NOT_FOUND", 404),
      );
      const empty = await newItem("STOCK-EMPTY");
      await assert.rejects(
        issue(a, "1", empty),
        hasCode("WAREHOUSE_BALANCE_NOT_FOUND", 404),
      );
      await assert.rejects(
        move(a, b, "1", empty),
        hasCode("WAREHOUSE_BALANCE_NOT_FOUND", 404),
      );
      assert.equal(await read(b, empty), null);
      const large = await newItem("STOCK-MAX");
      await receive(a, "99999999999.999", large);
      await assert.rejects(
        receive(a, "0.001", large),
        hasCode("WAREHOUSE_STOCK_QUANTITY_OVERFLOW", 409),
      );
      await receive(b, "1", large);
      await assert.rejects(
        move(b, a, "1", large),
        hasCode("WAREHOUSE_STOCK_QUANTITY_OVERFLOW", 409),
      );
      assert.equal((await read(b, large)).quantity, "1");
      assert.equal(await stock.getItemTotal(large), "100000000000.999");
      await assert.rejects(
        stock.receiveStock(
          { tx: prisma, actorUserId: actor.id },
          id,
          loc(a),
          "1",
        ),
        hasCode("WAREHOUSE_STOCK_TRANSACTION_REQUIRED", 400),
      );
    },
  );
}
