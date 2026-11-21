import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadReceiptPeriod } from "./warehouse-receipts-period-fixture.mjs";

export async function verifyReceiptPeriodHistory(c, fixture) {
  const {
    a,
    b,
    bind,
    createSource,
    history,
    importer,
    invoice,
    payload,
    period,
    receipts,
    run,
    service,
    warehouses,
  } = fixture;
  const { OneCInvoicePeriodImportService } = loadReceiptPeriod(
    "one-c-invoice-period-import.service.js",
  );
  const stock = await c.quantity();
  const reserves = await c.prisma.warehouseReservation.count();
  payload.total = 2;
  await assert.rejects(run(), { code: "ONE_C_INVOICES_INCOMPLETE" });
  assert.deepEqual(await history(), []);
  payload.total = 1;
  await run();
  assert.deepEqual(await receipts(), []);

  invoice.status = "POSTED";
  c.failAudit(true);
  try {
    const result = await run();
    assert.equal(result.outcome, "FAILED");
    assert.equal(result.errorCount, 1);
    assert.equal((await history()).length, 2);
    assert.deepEqual(await receipts(), []);
    payload.extra = [{ ...invoice, id: randomUUID(), status: "CREATED" }];
    payload.total = 2;
    const partial = await run();
    assert.equal(partial.outcome, "PARTIAL_FAILURE");
    assert.equal(partial.errorCount, 1);
  } finally {
    c.failAudit(false);
    payload.extra = [];
    payload.total = 1;
  }
  let lost = false;
  const retry = new OneCInvoicePeriodImportService(
    {
      $transaction: async (...args) => {
        const result = await c.prisma.$transaction(...args);
        if (result === true && !lost) {
          lost = true;
          throw new Error("Lost COMMIT acknowledgement");
        }
        return result;
      },
    },
    c.registry,
    importer,
  );
  const imported = await retry.importPeriod(a.code, period);
  assert.equal(imported.outcome, "SUCCESS");
  assert.equal(imported.errorCount, 0);
  assert.equal(
    imported.documents[0].groups.filter(({ status }) => status === "IMPORTED")
      .length,
    2,
  );
  assert.equal(
    imported.documents[0].groups.filter(({ status }) => status === "UNMAPPED")
      .length,
    1,
  );
  assert.equal(lost, true);
  const first = await receipts();
  assert.equal(first.length, 2);
  let lostApplyCommit = false;
  const lostBusinessCommit = new OneCInvoicePeriodImportService(
    {
      $transaction: async (...args) => {
        const committed = await c.prisma.$transaction(...args);
        if (committed?.outcome === "PROCESSED") {
          lostApplyCommit = true;
          throw new Error("Lost business COMMIT acknowledgement");
        }
        return committed;
      },
      $queryRaw: c.prisma.$queryRaw.bind(c.prisma),
      $executeRaw: c.prisma.$executeRaw.bind(c.prisma),
    },
    c.registry,
    importer,
  );
  assert.equal(
    (await lostBusinessCommit.importPeriod(b.code, period)).outcome,
    "SUCCESS",
  );
  assert.equal(lostApplyCommit, true);
  await Promise.all([run(a), run(b)]);
  assert.deepEqual(
    (await receipts()).map(({ id }) => id),
    first.map(({ id }) => id),
  );
  assert.equal((await history()).length, 2);
  assert.equal((await history())[1].payload.lines.length, 3);
  const { OneCInvoiceSchedulerService } = loadReceiptPeriod(
    "one-c-invoice-scheduler.service.js",
  );
  const scheduled = await createSource("Period with untracked warehouse");
  await c.coreSources.configureFlow(
    scheduled.code,
    "warehouse.receipts",
    {
      isActive: true,
      configVersion: 1,
      config: { enabled: true, initialFrom: "2026-11-14T00:00:00+03:00" },
    },
    c.admin.id,
  );
  const scheduler = new OneCInvoiceSchedulerService(c.prisma, service);
  const signal = new AbortController().signal;
  const summaries = async () =>
    new Map(
      (await c.coreSources.list(c.admin.id)).map(({ code, flows }) => [
        code,
        flows.find(({ flowCode }) => flowCode === "warehouse.receipts")
          ?.scheduleSummary,
      ]),
    );
  const before = await summaries();
  assert.deepEqual(before.get(scheduled.code), {
    outcome: null,
    errorCode: null,
  });
  assert.equal(before.get(a.code), null);
  await scheduler.run(scheduled.id, signal, new Date("2026-11-14T00:00:00Z"));
  const completed = (await scheduler.status(scheduled.code, c.admin.id)).latest;
  assert.equal(completed.outcome, "SUCCESS");
  assert.ok(completed.periodTo);
  assert.deepEqual(completed.syncedThrough, completed.periodTo);
  assert.deepEqual((await summaries()).get(scheduled.code), {
    outcome: "SUCCESS",
    errorCode: null,
  });
  const stateKey = { sourceId: scheduled.id, flowCode: "warehouse.receipts" };
  for (const outcome of ["FAILED", "PARTIAL_FAILURE", "BLOCKED"]) {
    await c.prisma.warehouseInvoiceSyncState.update({
      where: { sourceId_flowCode: stateKey },
      data: { lastOutcome: outcome, lastErrorCode: "TEST_ERROR" },
    });
    assert.deepEqual((await summaries()).get(scheduled.code), {
      outcome,
      errorCode: "TEST_ERROR",
    });
  }
  await c.prisma.warehouseInvoiceSyncState.update({
    where: { sourceId_flowCode: stateKey },
    data: { lastOutcome: "SUCCESS", lastErrorCode: null },
  });
  await c.coreSources.configureFlow(
    scheduled.code,
    "warehouse.receipts",
    { isActive: true, configVersion: 1, config: {} },
    c.admin.id,
  );
  assert.equal((await summaries()).get(scheduled.code), null);
  assert.deepEqual(
    (await receipts()).map(({ id }) => id),
    first.map(({ id }) => id),
  );
  await bind(warehouses[2]);
  await service.reprocess(b.code, invoice.id);
  const recovered = await receipts();
  assert.equal(recovered.length, 3);
  assert.equal(recovered[2].externalWarehouseId, warehouses[2]);
  assert.deepEqual(
    recovered.slice(0, 2).map(({ id }) => id),
    first.map(({ id }) => id),
  );
  await service.reprocess(b.code, invoice.id);
  assert.deepEqual(
    (await receipts()).map(({ id }) => id),
    recovered.map(({ id }) => id),
  );
  return { first, stock, reserves };
}
