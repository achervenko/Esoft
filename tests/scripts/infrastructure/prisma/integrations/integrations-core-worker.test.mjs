import assert from "node:assert/strict";

export async function verifyWorker(c, t) {
  const { accept, payload, worker, otherWorker, prisma } = c;
  await t.test(
    "expired lease is reclaimed and stale completion cannot overwrite the new owner",
    async () => {
      const body = payload(),
        stored = await accept(body),
        id = BigInt(stored.id),
        first = await worker.claim(id);
      assert.ok(first);
      await prisma.integrationEvent.update({
        where: { id },
        data: { leaseUntil: new Date(0) },
      });
      const second = await otherWorker.claim(id);
      assert.ok(second);
      assert.notEqual(first.leaseToken, second.leaseToken);
      assert.equal(await worker.finish(id, first.leaseToken), false);
      assert.equal(await worker.renew(id, first.leaseToken), false);
      assert.equal(await otherWorker.finish(id, second.leaseToken), true);
      const history = await prisma.integrationAttempt.findMany({
        where: { eventId: id },
        orderBy: { startedAt: "asc" },
      });
      assert.deepEqual(
        history.map((x) => x.outcome),
        ["LEASE_EXPIRED", "PROCESSED"],
      );
    },
  );
  await t.test(
    "missing handler remains pending without consuming attempts",
    async () => {
      const stored = await accept(payload()),
        id = BigInt(stored.id);
      await c.createWorkerWithoutHandlers().process(id);
      const state = await prisma.integrationEvent.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(state.status, "PENDING");
      assert.equal(state.attempts, 0);
      assert.equal(state.lastErrorCode, "HANDLER_UNAVAILABLE");
      await prisma.integrationEvent.update({
        where: { id },
        data: { nextAttemptAt: new Date(0) },
      });
      await worker.process(id);
      assert.equal(
        (
          await prisma.integrationEvent.findUniqueOrThrow({
            where: { id },
          })
        ).status,
        "PROCESSED",
      );
    },
  );
}
