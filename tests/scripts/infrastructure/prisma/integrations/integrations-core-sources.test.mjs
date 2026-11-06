import assert from "node:assert/strict";

export async function verifySources(c, t) {
  const { sources, source, admin, prisma, accept, payload, worker } = c;
  await t.test(
    "two flows share one source, immutable actor and secret-free reads",
    async () => {
      const renamed = await sources.update(
        source.code,
        { name: "Новое имя", authorization: "" },
        admin.id,
      );
      assert.equal(renamed.actorUserId, source.actorUserId);
      assert.equal(renamed.code, source.code);
      const actor = await prisma.user.findUniqueOrThrow({
        where: { id: source.actorUserId },
        include: { accounts: true },
      });
      assert.equal(actor.name, "1С — основная");
      assert.equal(actor.accounts.length, 0);
      assert.equal(actor.role, "system:integration");
      assert.ok(
        !JSON.stringify(await sources.list(admin.id)).includes("secret"),
      );
    },
  );
  await t.test("disabling source blocks admission and claims", async () => {
    const stored = await accept(payload()),
      id = BigInt(stored.id);
    await sources.update(source.code, { isActive: false }, admin.id);
    await assert.rejects(accept(payload()));
    assert.equal(await worker.claim(id), null);
    await sources.update(source.code, { isActive: true }, admin.id);
  });
}
