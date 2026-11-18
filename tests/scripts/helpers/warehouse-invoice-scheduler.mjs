import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  IntegrationFailure: ImportError,
} = require("../../../backend/dist/src/integrations/integration-errors.js");
const {
  OneCInvoiceSchedulerService,
} = require("../../../backend/dist/src/warehouse/receipt-integration/one-c-invoice-scheduler.service.js");

export async function verifyInvoiceScheduler(c, t, source) {
  await t.test(
    "scheduler fences concurrent and interrupted runs and persists exact retries",
    async () => {
      const flowCode = "warehouse.receipts";
      const fixedNow = new Date("2026-11-18T12:00:00Z");
      const config = { enabled: true, initialFrom: "2026-11-18T08:00:00Z" };
      const configure = (value) =>
        c.coreSources.configureFlow(
          source.code,
          flowCode,
          { configVersion: 1, isActive: true, config: value },
          c.admin.id,
        );
      const latest = () =>
        c.prisma.warehouseInvoiceSyncRun.findFirst({
          where: { sourceId: source.id, flowCode },
          orderBy: { id: "desc" },
        });
      const stateKey = { sourceId: source.id, flowCode };
      const state = () =>
        c.prisma.warehouseInvoiceSyncState.findUnique({
          where: { sourceId_flowCode: stateKey },
        });
      const purgeFinished = () =>
        c.prisma.warehouseInvoiceSyncRun.deleteMany({
          where: { ...stateKey, finishedAt: { not: null } },
        });
      const result = (outcome) => ({ outcome, documents: [] });
      let action = () => result("PARTIAL_FAILURE");
      const importer = { importPeriod: (...args) => action(...args) };
      const first = new OneCInvoiceSchedulerService(c.prisma, importer);
      const second = new OneCInvoiceSchedulerService(c.prisma, importer);
      const signal = new AbortController().signal;
      const run = (scheduler = first, now = fixedNow) =>
        scheduler.run(source.id, signal, now);
      await run();
      assert.equal(await latest(), null);
      assert.equal(await state(), null);
      await configure(config);
      const entered = Promise.withResolvers();
      const release = Promise.withResolvers();
      action = async (_code, window) => {
        entered.resolve(window);
        await release.promise;
        return result("PARTIAL_FAILURE");
      };
      const running = run();
      try {
        // The 1C request uses Europe/Moscow wall time, while the journal stores UTC instants.
        assert.deepEqual(await Promise.race([entered.promise, running]), {
          dateFrom: "2026-11-18T11:00:00",
          dateTo: "2026-11-18T12:00:00",
        });
        const start = await latest();
        assert.equal(start.outcome, "RUNNING");
        assert.equal(
          start.periodFrom.toISOString(),
          "2026-11-18T08:00:00.000Z",
        );
        assert.equal(start.periodTo.toISOString(), "2026-11-18T09:00:00.000Z");
        const runningState = await state();
        assert.equal(runningState.lastOutcome, "RUNNING");
        await purgeFinished();
        assert.equal((await latest()).id, start.id);
        await run(second);
        assert.equal((await latest()).id, start.id);
        assert.deepEqual(await state(), runningState);
      } finally {
        release.resolve();
        await running;
      }
      const partial = await state();
      assert.equal(partial.lastOutcome, "PARTIAL_FAILURE");
      assert.equal(partial.syncedThrough, null);
      assert.equal(partial.nextAttemptAt - partial.lastFinishedAt, 60_000);
      await run(second, partial.lastFinishedAt);
      assert.deepEqual(await state(), partial);
      action = () => {
        throw new ImportError("INTEGRATION_HTTP_TIMEOUT", true);
      };
      await run(second, partial.nextAttemptAt);
      const timedOut = await state();
      assert.equal(timedOut.lastOutcome, "FAILED");
      assert.equal(timedOut.lastErrorCode, "INTEGRATION_HTTP_TIMEOUT");
      assert.equal(timedOut.syncedThrough, null);
      assert.equal(timedOut.nextAttemptAt - timedOut.lastFinishedAt, 120_000);
      action = () => {
        throw new ImportError("INTEGRATION_HTTP_401", false);
      };
      assert.equal(timedOut.consecutiveFailures, 2);
      assert.equal((await purgeFinished()).count, 2);
      assert.equal(await latest(), null);
      assert.deepEqual(await state(), timedOut);
      await run(second, timedOut.lastFinishedAt);
      assert.deepEqual(await state(), timedOut);
      await run(second, timedOut.nextAttemptAt);
      const blocked = await state();
      assert.equal(blocked.lastOutcome, "BLOCKED");
      assert.equal(blocked.periodFrom.getTime(), partial.periodFrom.getTime());
      assert.equal(blocked.periodTo.getTime(), partial.periodTo.getTime());
      assert.equal(blocked.syncedThrough, null);
      await run(first, new Date(blocked.lastFinishedAt.getTime() + 86_400_000));
      assert.deepEqual(await state(), blocked);
      await configure({ ...config, intervalSeconds: 10 });
      action = () => result("SUCCESS");
      await run(second, blocked.lastFinishedAt);
      const success = await state();
      assert.equal(success.lastOutcome, "SUCCESS");
      assert.equal(success.syncedThrough.getTime(), partial.periodTo.getTime());
      assert.equal(success.attempt, 4);
      assert.equal(
        (await first.status(source.code, c.admin.id)).lastSuccessAt.getTime(),
        success.lastFinishedAt.getTime(),
      );
      await assert.rejects(first.status(source.code, c.keeper.id), {
        status: 403,
      });

      const gate = Promise.withResolvers();
      const resume = Promise.withResolvers();
      action = async () => {
        gate.resolve();
        await resume.promise;
        return result("SUCCESS");
      };
      const stale = run(first, fixedNow);
      let abandoned;
      try {
        await Promise.race([gate.promise, stale]);
        abandoned = await latest();
        assert.equal(
          abandoned.periodFrom.toISOString(),
          "2026-11-18T08:45:00.000Z",
        );
        const key = JSON.stringify([
          "warehouse:invoice-schedule",
          source.id,
          flowCode,
        ]);
        const [{ terminated }] = await c.prisma.$queryRaw`
        SELECT pg_terminate_backend(pid) AS terminated FROM pg_locks
        WHERE locktype='advisory' AND granted AND objsubid=1
          AND classid::bigint=((hashtextextended(${key},0) >> 32) & 4294967295)
          AND objid::bigint=(hashtextextended(${key},0) & 4294967295)`;
        assert.equal(terminated, true);
      } finally {
        resume.resolve();
      }
      await assert.rejects(stale);
      assert.equal(
        (await state()).syncedThrough.getTime(),
        success.syncedThrough.getTime(),
      );
      action = () => result("SUCCESS");
      await run(second, fixedNow);
      assert.equal(
        (await state()).syncedThrough.getTime(),
        abandoned.periodTo.getTime(),
      );
      assert.equal((await state()).attempt, 2);
      assert.equal(
        (
          await c.prisma.warehouseInvoiceSyncRun.findUnique({
            where: { id: abandoned.id },
          })
        ).outcome,
        "INTERRUPTED",
      );

      const configuring = Promise.withResolvers();
      const configured = Promise.withResolvers();
      action = async () => {
        configuring.resolve();
        await configured.promise;
        return result("SUCCESS");
      };
      const changing = run();
      const before = await state();
      try {
        await Promise.race([configuring.promise, changing]);
        await configure({ ...config, enabled: false });
      } finally {
        configured.resolve();
        await changing;
      }
      const changed = await state();
      assert.equal(changed.lastErrorCode, "ONE_C_INVOICE_SCHEDULE_CHANGED");
      assert.equal(
        changed.syncedThrough.getTime(),
        before.syncedThrough.getTime(),
      );
      await run(second);
      assert.deepEqual(await state(), changed);

      await configure({ ...config, intervalSeconds: 10 });
      action = () => result("SUCCESS");
      await run(second, changed.nextAttemptAt);
      const resumed = await state();
      assert.equal(resumed.lastOutcome, "SUCCESS");
      const resumedAt = new Date(resumed.syncedThrough.getTime() + 60_000);
      await c.prisma.warehouseInvoiceSyncState.update({
        where: { sourceId_flowCode: stateKey },
        data: { lastStartedAt: resumedAt, lastFinishedAt: resumedAt },
      });
      const caughtUpAt = new Date(resumed.syncedThrough.getTime() + 90_000);
      await run(first, caughtUpAt);
      const caughtUp = await state();
      assert.equal(
        caughtUp.syncedThrough.getTime(),
        caughtUpAt.getTime() - 60_000,
      );
      await c.prisma.warehouseInvoiceSyncState.update({
        where: { sourceId_flowCode: stateKey },
        data: { lastFinishedAt: caughtUpAt },
      });
      const beforeCleanup = await state();
      await purgeFinished();
      assert.equal(await latest(), null);
      assert.deepEqual(await state(), beforeCleanup);
      assert.deepEqual(
        (await first.status(source.code, c.admin.id)).lastSuccessAt,
        beforeCleanup.lastSuccessAt,
      );
      await run(second, new Date(caughtUpAt.getTime() + 9_000));
      assert.equal(await latest(), null);
      await run(second, new Date(caughtUpAt.getTime() + 10_000));
      assert.equal((await latest()).outcome, "SUCCESS");
      assert.equal(
        (await state()).periodFrom.getTime(),
        beforeCleanup.syncedThrough.getTime() - 15 * 60_000,
      );
      assert.ok((await state()).syncedThrough > beforeCleanup.syncedThrough);
      assert.equal((await state()).consecutiveFailures, 0);
    },
  );
}
