import assert from "node:assert/strict";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyStockLocking(context, t) {
  const {
    prisma,
    database,
    namespace,
    actor,
    stock,
    catalog,
    a,
    loc,
    transaction,
    receive,
    read,
    newItem,
  } = context;
  await t.test(
    "Catalog cannot change the unit while a first Stock receipt is in progress",
    async () => {
      const fresh = await newItem("STOCK-UNIT");
      let ready;
      let release;
      const locked = new Promise((resolve) => {
        ready = resolve;
      });
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const receiving = transaction(async (ctx) => {
        await stock.lockBalances(ctx.tx, fresh, [loc(a)]);
        ready();
        await gate;
        await stock.receiveStock(ctx, fresh, loc(a), "1");
      });
      try {
        await Promise.race([locked, receiving]);
        const updating = catalog.update(fresh, { unit: "кг" }, actor.id);
        const assertion = assert.rejects(
          updating,
          hasCode("WAREHOUSE_UNIT_IN_USE", 409),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
          waiting = (
            await database.query(`SELECT EXISTS (
  SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
  AND wait_event_type = 'Lock' AND query LIKE '%warehouse_items%'
  AND query LIKE '%FOR UPDATE%'
) AS waiting`)
          ).rows[0].waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(
          waiting,
          true,
          "Catalog must wait even before the first balance is inserted",
        );
        release();
        await Promise.all([receiving, assertion]);
      } finally {
        release();
        await receiving;
      }
      assert.equal((await catalog.findOne(fresh)).unit, "шт");
    },
  );
}
