import assert from "node:assert/strict";

export async function verifyRetry(c, t) {
  const { accept, payload, worker, prisma, events, admin } = c;
  await t.test(
    "permanent failure, audited manual retry, retry exhaustion and redacted errors",
    async () => {
      const stored = await accept(payload()),
        id = BigInt(stored.id);
      c.setBehavior("permanent");
      await worker.process(id);
      assert.equal(
        (
          await prisma.integrationEvent.findUniqueOrThrow({
            where: { id },
          })
        ).status,
        "FAILED",
      );
      c.setAuditFails(true);
      await assert.rejects(events.retry(id, admin.id));
      assert.equal(
        (
          await prisma.integrationEvent.findUniqueOrThrow({
            where: { id },
          })
        ).status,
        "FAILED",
      );
      c.setAuditFails(false);
      await events.retry(id, admin.id);
      c.setBehavior("retry");
      await worker.process(id);
      let state = await prisma.integrationEvent.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(state.status, "PENDING");
      assert.equal(state.manualRetryCount, 1);
      assert.equal(state.attempts, 2);
      assert.equal(state.retryAttempts, 1);
      assert.equal(state.lastErrorCode, "INTEGRATION_HANDLER_FAILED");
      assert.ok(
        !JSON.stringify(state, (_, v) =>
          typeof v === "bigint" ? String(v) : v,
        ).includes("DO-NOT-LOG"),
      );
      await prisma.integrationEvent.update({
        where: { id },
        data: { retryAttempts: 7, nextAttemptAt: new Date(0) },
      });
      await worker.process(id);
      state = await prisma.integrationEvent.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(state.status, "FAILED");
      c.setBehavior("ok");
      await events.retry(id, admin.id);
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
  await t.test(
    "skip retention deletes only expired skipped events and their attempts",
    async () => {
      const oldSkip = await c.accept(c.payload());
      const recentSkip = await c.accept(c.payload());
      const failed = await c.accept(c.payload());
      const oldDate = new Date(Date.now() - 31 * 86400000);
      await c.prisma.integrationEvent.update({
        where: { id: BigInt(oldSkip.id) },
        data: {
          status: "SKIPPED",
          processedAt: oldDate,
          resultCode: "TEST_IGNORED",
        },
      });
      await c.prisma.integrationAttempt.create({
        data: {
          eventId: BigInt(oldSkip.id),
          leaseToken: c.payload().eventId,
          outcome: "SKIPPED",
          startedAt: oldDate,
          finishedAt: oldDate,
        },
      });
      await c.prisma.integrationEvent.update({
        where: { id: BigInt(recentSkip.id) },
        data: {
          status: "SKIPPED",
          processedAt: new Date(),
          resultCode: "TEST_IGNORED",
        },
      });
      await c.prisma.integrationEvent.update({
        where: { id: BigInt(failed.id) },
        data: { status: "FAILED", processedAt: oldDate },
      });
      await c.worker.cleanupSkipped();
      assert.equal(
        await c.prisma.integrationEvent.findUnique({
          where: { id: BigInt(oldSkip.id) },
        }),
        null,
      );
      assert.equal(
        await c.prisma.integrationAttempt.count({
          where: { eventId: BigInt(oldSkip.id) },
        }),
        0,
      );
      assert.ok(
        await c.prisma.integrationEvent.findUnique({
          where: { id: BigInt(recentSkip.id) },
        }),
      );
      assert.ok(
        await c.prisma.integrationEvent.findUnique({
          where: { id: BigInt(failed.id) },
        }),
      );
    },
  );
}
