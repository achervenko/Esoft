import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verify(run) {
  await run(
    "generic storage accepts UUID/bigint owners without a module enum",
    async ({ prisma, admin, staged, file }) => {
      for (const entityId of [randomUUID(), "9223372036854775807"]) {
        const scope = {
          module: "new_module",
          entityType: "new_document",
        };
        const pending = await staged.prepare(
          scope,
          admin.id,
          "supporting_document",
          file,
        );
        const [bound] = await prisma.$transaction((tx) =>
          staged.attach(
            tx,
            [pending.uploadId],
            { ...scope, entityId },
            admin.id,
            true,
          ),
        );
        assert.equal(bound.ownerEntityId, entityId);
        assert.equal(bound.ownerModule, "new_module");
        assert.equal(bound.isImmutable, true);
      }
    },
  );
}
