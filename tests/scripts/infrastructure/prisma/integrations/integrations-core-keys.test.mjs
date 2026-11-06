import assert from "node:assert/strict";
import { verifySharedActorKeys } from "../../../helpers/integrations-shared-actor-keys.mjs";

export async function verifyKeys(c, t) {
  const { keys, source, admin, accept, payload, worker, seen } = c;
  await t.test(
    "shared actors cannot expose or revoke another source's machine keys",
    () => verifySharedActorKeys(c),
  );
  await t.test(
    "keys permit only registered actions of their selected flow",
    async () => {
      await assert.rejects(accept(payload(), "test.second"));
      await assert.rejects(
        keys.create(
          source.code,
          { name: "bad", flows: { "test.first": ["users:manage"] } },
          admin.id,
        ),
      );
      const secondKey = await keys.create(
        source.code,
        {
          name: "second flow",
          flows: { "test.second": ["event:create"] },
        },
        admin.id,
      );
      const second = await accept(payload(), "test.second", secondKey.key);
      await worker.process(BigInt(second.id));
      assert.ok(seen.some((s) => s.endsWith(":test.second")));
    },
  );
}
