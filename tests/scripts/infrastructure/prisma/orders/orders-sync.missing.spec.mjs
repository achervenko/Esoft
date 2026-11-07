import assert from "node:assert/strict";
import { rawOrder } from "./orders-sync.test-context.mjs";
export async function verifyMissing(context, t) {
  const { first, service, refresh, find, state } = context;
  await t.test(
    "absence needs two consecutive complete snapshots and recovery keeps identity",
    async () => {
      const original = await find();
      const count = (await service.history(original.id, {})).total;
      state.rows = [];
      await refresh();
      assert.equal((await find()).missingChecks, 1);
      assert.equal((await service.list({ missing: "true" })).total, 0);
      state.rows = [{ ...first, Number: original.number }];
      await refresh();
      assert.equal((await find()).missingChecks, 0);
      assert.equal((await service.history(original.id, {})).total, count);

      const lastSeen = (await find()).checkedAt;
      state.rows = [];
      await refresh();
      state.rows = [rawOrder()];
      state.broken = true;
      await assert.rejects(
        refresh(),
        (e) => e.code === "ORDERS_RESPONSE_INVALID",
      );
      state.broken = false;
      assert.equal((await find()).missingChecks, 1);

      state.rows = [];
      assert.equal((await refresh()).changed, 1);
      assert.equal((await find()).status, original.status);
      assert.deepEqual((await find()).checkedAt, lastSeen);
      assert.equal(
        (await service.list({ missing: "true" })).items[0].id,
        original.id,
      );
      assert.equal((await refresh()).changed, 0);

      state.rows = [{ ...first, Number: original.number }];
      assert.equal((await refresh()).changed, 1);
      assert.equal((await find()).id, original.id);
      const history = await service.history(original.id, {});
      assert.equal(history.total, count + 2);
      assert.deepEqual(
        history.items.slice(0, 2).map((change) => change.after.missing),
        [false, true],
      );
    },
  );
}
