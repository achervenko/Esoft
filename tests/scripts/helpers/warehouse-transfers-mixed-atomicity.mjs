import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMixedAtomicity(
  c,
  t,
  { transfers, admin },
  fixture,
) {
  await t.test(
    "a failure after partial movement rolls back all stock, allocations, document and key",
    async () => {
      const f = await fixture(),
        before = await f.state();
      const write = c.audit.writeFieldChanges;
      c.audit.writeFieldChanges = async function (input) {
        if (input.entityType === "warehouse_transfer")
          throw new Error("mixed audit test failure");
        return write.call(this, input);
      };
      try {
        await assert.rejects(
          async () => transfers.create(f.command, admin.id),
          /mixed audit test failure/,
        );
      } finally {
        c.audit.writeFieldChanges = write;
      }
      assert.deepEqual(await f.state(), before);
      await transfers.create(f.command, admin.id);
      assert.equal((await f.state()).transfers, 1);
    },
  );
  await t.test(
    "concurrent mixed commands and repeated keys preserve physical and reserved quantities",
    async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        transfers.create(f.command, admin.id),
        transfers.create({ ...f.command, requestKey: randomUUID() }, admin.id),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await f.state()).transfers, 1);
      const g = await fixture();
      const replay = await Promise.all([
        transfers.create(g.command, admin.id),
        transfers.create(g.command, admin.id),
      ]);
      assert.equal(replay[0].id, replay[1].id);
      assert.equal((await g.state()).transfers, 1);
    },
  );
}
