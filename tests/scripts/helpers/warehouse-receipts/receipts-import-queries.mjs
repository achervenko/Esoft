import assert from "node:assert/strict";

export async function receiptsImportQueries(c, t) {
  await t.test(
    "active query includes completed documents with conflicts and isolates warehouses",
    async () => {
      const doc = c.source();
      let r = await c.mapped(doc);
      await c.place(r, "10");
      await c.ingest({ ...doc, version: "2", status: "CANCELLED" });
      const list = await c.queries.list({
        warehouseId: String(c.warehouse.id),
      });
      assert.ok(list.items.some((x) => x.id === r.id && x.hasProblems));
      const conflicts = await c.queries.list({
        warehouseId: String(c.warehouse.id),
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        hasConflict: "true",
      });
      assert.ok(conflicts.items.some((x) => x.id === r.id));
      assert.ok(conflicts.items.every((x) => x.conflict !== null));
      const onlyConflicts = await c.queries.list({
        warehouseId: String(c.warehouse.id),
        status: "CONFLICT",
      });
      assert.ok(onlyConflicts.items.some((x) => x.id === r.id));
      assert.ok(onlyConflicts.items.every((x) => x.conflict !== null));
      const union = await c.queries.list({
        warehouseId: String(c.warehouse.id),
        status: "RECEIVED,CONFLICT",
      });
      assert.ok(union.items.some((x) => x.id === r.id));
      assert.ok(
        union.items.every(
          (x) => x.status === "RECEIVED" || x.conflict !== null,
        ),
      );

      const work = await c.queries.list({
        warehouseId: String(c.warehouse.id),
        status: "RECEIVED,PLACING",
        hasConflict: "false",
      });
      assert.ok(
        work.items.every(
          (x) =>
            x.conflict === null && ["RECEIVED", "PLACING"].includes(x.status),
        ),
      );
      assert.ok(!work.items.some((x) => x.id === r.id));
      await assert.rejects(
        async () => c.queries.list({ hasConflict: "yes" }),
        (error) => error.status === 400,
      );

      assert.equal(
        (await c.queries.list({ warehouseId: String(c.foreign.id) })).items
          .length,
        0,
      );
      const history = await c.queries.list({ status: "PLACED" });
      assert.ok(history.total > 0);
    },
  );
}
