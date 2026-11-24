import assert from "node:assert/strict";
import { code } from "../warehouse-receipts-test-context.mjs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { createReservationFixture } from "../warehouse-reservation-fixture.mjs";
const { AuditLogService } = createRequire(import.meta.url)(
  "../../../../backend/dist/src/audit/audit-log.service.js",
);

export async function receiptsImportCancellation(c, t) {
  await t.test(
    "cancellation before/after placement and service lines",
    async (t) => {
      const doc = c.source();
      let r = await c.mapped(doc);
      r = await c.ingest({ ...doc, version: "2", status: "CANCELLED" });
      assert.equal(r.status, "CANCELLED");
      await assert.rejects(c.place(r), code("WAREHOUSE_RECEIPT_BLOCKED"));
      r = await c.ingest({ ...doc, version: "3", status: "POSTED" });
      assert.equal(r.status, "RECEIVED");
      assert.equal(r.conflict, null);
      const doc2 = c.source();
      r = await c.mapped(doc2);
      await c.place(r, "2");
      const before = await c.quantity();
      r = await c.ingest({ ...doc2, version: "2", status: "CANCELLED" });
      assert.equal(r.conflict, "SOURCE_CANCELLED_AFTER_PLACEMENT");
      assert.equal(await c.quantity(), before);
      const cancelledSnapshot = r.pendingSourceDocument;
      assert.equal(cancelledSnapshot.status, "CANCELLED");
      assert.equal(cancelledSnapshot.version, "2");
      const storedBefore = await c.prisma.warehouseReceipt.findUniqueOrThrow({
        where: { id: BigInt(r.id) },
      });
      const realAudit = new AuditLogService(c.prisma);
      t.mock.method(
        c.audit,
        "writeFieldChanges",
        realAudit.writeFieldChanges.bind(realAudit),
      );
      await c.conflictResolution.resolve(
        r.id,
        {
          action: "ACCEPT_CANCELLATION",
          reason: "Остаток оставлен для отдельной корректировки",
          sourceVersion: "2",
        },
        c.keeper.id,
      );
      const accepted = await c.receipts.findOne(r.id);
      assert.equal(accepted.status, "CANCELLED");
      assert.equal(accepted.conflict, null);
      assert.equal(accepted.pendingSourceDocument, null);
      assert.deepEqual(accepted.sourceDocument, cancelledSnapshot);
      assert.equal(accepted.sourceVersion, "2");
      assert.equal(accepted.lines[0].placed, "2");
      assert.equal(await c.quantity(), before);
      const storedAfter = await c.prisma.warehouseReceipt.findUniqueOrThrow({
        where: { id: BigInt(r.id) },
      });
      assert.equal(storedAfter.requestHash, storedBefore.requestHash);
      const audit = await c.prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "warehouse_receipt",
          entityStringId: r.id,
          fieldName: "Ручное решение конфликта",
          userId: c.keeper.id,
        },
      });
      const decision = JSON.parse(audit.newValue);
      assert.equal(decision.action, "ACCEPT_CANCELLATION");
      assert.equal(decision.sourceVersion, "2");
      assert.equal(
        decision.reason,
        "Остаток оставлен для отдельной корректировки",
      );
      assert.deepEqual(decision.acceptedSource, cancelledSnapshot);
      assert.equal(Object.hasOwn(decision, "rejectedSource"), false);
      assert.deepEqual(
        (await c.ingest({ ...doc2, version: "2", status: "CANCELLED" }))
          .sourceDocument,
        cancelledSnapshot,
      );
      const service = c.source();
      service.lines[0].item.type = "SERVICE";
      r = await c.mapped(service);
      assert.equal(r.hasProblems, true);
      await assert.rejects(c.place(r), code("WAREHOUSE_RECEIPT_ITEM_TYPE"));
    },
  );
  await t.test(
    "accepts cancellation under Stock locks without mutating stock, reserves, or placements",
    async () => {
      const first = await c.prisma.warehouseItem.create({
        data: {
          article: c.namespace + "cancel-first",
          name: "First item",
          unit: "шт",
        },
      });
      const second = await c.prisma.warehouseItem.create({
        data: {
          article: c.namespace + "cancel-second",
          name: "Second item",
          unit: "шт",
        },
      });
      const template = c.source().lines[0];
      const firstLine = {
        ...template,
        order: undefined,
        quantity: "2",
        item: { ...template.item, id: first.article },
      };
      const doc = c.source({
        lines: [
          firstLine,
          { ...firstLine, id: "line-2", quantity: "3" },
          {
            ...firstLine,
            id: "line-3",
            item: { ...template.item, id: second.article },
          },
        ],
      });
      const initial = await c.ingest(doc);
      await c.itemMapping.mapItem(
        initial.id,
        initial.lines[0].id,
        { itemId: String(first.id) },
        c.keeper.id,
      );
      await c.itemMapping.mapItem(
        initial.id,
        initial.lines[2].id,
        { itemId: String(second.id) },
        c.keeper.id,
      );
      const mapped = await c.receipts.findOne(initial.id);
      const [linkedLine, ...directLines] = mapped.lines;
      const manual = await c.manual(linkedLine.quantity, {
        lines: [{ itemId: String(first.id), quantity: linkedLine.quantity }],
      });
      await c.place(manual, linkedLine.quantity);
      await c.reconciliation.reconcile(
        mapped.id,
        {
          manualReceiptId: manual.id,
          lines: [
            { manualLineId: manual.lines[0].id, receiptLineId: linkedLine.id },
          ],
        },
        c.keeper.id,
      );
      for (const line of directLines)
        await c.placements.place(
          mapped.id,
          line.id,
          c.placement(line.quantity),
          c.keeper.id,
        );

      const cancelled = { ...doc, version: "2", status: "CANCELLED" };
      const receipt = await c.ingest(cancelled);
      const body = {
        action: "ACCEPT_CANCELLATION",
        reason: "Отмена подтверждена",
        sourceVersion: receipt.sourceVersion,
      };
      const resolve = () =>
        c.conflictResolution.resolve(receipt.id, body, c.keeper.id);
      await assert.rejects(
        c.conflictResolution.resolve(
          receipt.id,
          body,
          c.namespace + "missing-user",
        ),
        code("FORBIDDEN"),
      );
      await assert.rejects(
        c.conflictResolution.resolve(
          receipt.id,
          { ...body, sourceVersion: "1" },
          c.admin.id,
        ),
        code("WAREHOUSE_RECEIPT_CONFLICT_STALE"),
      );
      const stockTx = (work) =>
        c.prisma.$transaction((tx) => work({ tx, actorUserId: c.admin.id }), {
          timeout: 15000,
        });
      await stockTx((ctx) =>
        c.stock.moveStock(
          ctx,
          String(first.id),
          String(c.location.id),
          String(c.target.id),
          "5",
        ),
      );
      const reservations = await createReservationFixture({
        ...c,
        actor: c.admin,
        id: String(second.id),
        loc: String,
        transaction: stockTx,
      });
      await reservations.reserve(reservations.input(c.location.id, "1"));
      const stockBefore = async () =>
        c.prisma.warehouseBalance.findMany({
          where: { itemId: { in: [first.id, second.id] } },
          orderBy: { id: "asc" },
        });
      const reservesBefore = () =>
        c.prisma.warehouseReservationAllocation.findMany({
          where: { reservation: { itemId: { in: [first.id, second.id] } } },
          orderBy: { id: "asc" },
        });

      const held = Promise.withResolvers();
      const release = Promise.withResolvers();
      const issuing = stockTx(async (ctx) => {
        try {
          const [{ pid }] = await ctx.tx
            .$queryRaw`SELECT pg_backend_pid() AS pid`;
          await c.stock.issueStock(
            ctx,
            String(first.id),
            String(c.target.id),
            "1",
          );
          held.resolve(pid);
          await release.promise;
        } catch (error) {
          held.reject(error);
          throw error;
        }
      });
      const blocker = await held.promise;
      const rejected = assert.rejects(resolve(), (error) => {
        code("WAREHOUSE_RECEIPT_CANCELLATION_STOCK_INSUFFICIENT")(error);
        assert.deepEqual(error.response.details.shortages, [
          {
            itemId: String(first.id),
            name: first.name,
            unit: first.unit,
            required: "5",
            physical: "4",
            shortage: "1",
          },
        ]);
        return true;
      });
      try {
        let waiting = false;
        for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
          [{ waiting }] = await c.prisma.$queryRaw`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database()
                AND ${blocker}::integer = ANY(pg_blocking_pids(pid))
                AND query LIKE '%pg_advisory_xact_lock%'
            ) AS waiting`;
          if (!waiting) await delay(20);
        }
        assert.equal(
          waiting,
          true,
          "Cancellation must wait for Stock to commit",
        );
      } finally {
        release.resolve();
        await Promise.all([issuing, rejected]);
      }
      assert.equal(
        (await c.receipts.findOne(receipt.id)).conflict,
        receipt.conflict,
      );
      await stockTx((ctx) =>
        c.stock.receiveStock(ctx, String(first.id), String(c.target.id), "1"),
      );
      await stockTx((ctx) =>
        c.stock.issueStock(ctx, String(second.id), String(c.location.id), "1"),
      );
      await assert.rejects(resolve(), (error) => {
        code("WAREHOUSE_RECEIPT_CANCELLATION_STOCK_INSUFFICIENT")(error);
        assert.equal(
          error.response.details.shortages[0].itemId,
          String(second.id),
        );
        return true;
      });
      await stockTx((ctx) =>
        c.stock.receiveStock(
          ctx,
          String(second.id),
          String(c.location.id),
          "1",
        ),
      );
      const [allocation] = await reservesBefore();
      // Simulate already inconsistent data to exercise the cancellation guard.
      await c.prisma.warehouseReservationAllocation.update({
        where: { id: allocation.id },
        data: { quantity: "3" },
      });
      try {
        await assert.rejects(
          resolve(),
          code("WAREHOUSE_RESERVATION_STOCK_MISMATCH"),
        );
      } finally {
        await c.prisma.warehouseReservationAllocation.update({
          where: { id: allocation.id },
          data: { quantity: allocation.quantity },
        });
      }

      const { WarehouseReceiptConflictResolutionService } = createRequire(
        import.meta.url,
      )(
        "../../../../backend/dist/src/warehouse/receipts/receipt-conflict-resolution.service.js",
      );
      const failing = new WarehouseReceiptConflictResolutionService(
        c.prisma,
        {
          writeFieldChanges: async () => {
            throw Error("audit failed");
          },
        },
        c.warehouseNotifications,
      );
      await assert.rejects(
        failing.resolve(receipt.id, body, c.admin.id),
        /audit failed/,
      );
      assert.equal(
        (await c.receipts.findOne(receipt.id)).conflict,
        receipt.conflict,
      );
      const balances = await stockBefore();
      const reserves = await reservesBefore();
      assert.equal(reserves.length, 1);
      const results = await Promise.allSettled([resolve(), resolve()]);
      assert.equal(
        results.filter(({ status }) => status === "fulfilled").length,
        1,
      );
      code("WAREHOUSE_RECEIPT_CONFLICT_STALE")(
        results.find(({ status }) => status === "rejected").reason,
      );
      const accepted = await c.receipts.findOne(receipt.id);
      assert.equal(accepted.status, "CANCELLED");
      assert.deepEqual(accepted.lines, receipt.lines);
      assert.deepEqual(await stockBefore(), balances);
      assert.deepEqual(await reservesBefore(), reserves);
      assert.equal((await c.ingest(cancelled)).conflict, null);
      const snapshot = (value) =>
        c.prisma.$transaction((tx) =>
          c.importer.applySnapshot(tx, c.sourceSystem, value, c.admin.id),
        );
      const reposted = await snapshot(doc);
      assert.equal(reposted.conflict, "SOURCE_REPOSTED_AFTER_SETTLEMENT");
      assert.equal(reposted.status, "CANCELLED");
      assert.equal(reposted.sourceDocument.status, "CANCELLED");
      assert.equal(reposted.pendingSourceDocument.status, "POSTED");
      assert.deepEqual(reposted.lines, accepted.lines);
      assert.deepEqual(await stockBefore(), balances);
      await assert.rejects(
        c.place(reposted),
        code("WAREHOUSE_RECEIPT_BLOCKED"),
      );
      const replay = await snapshot(doc);
      assert.equal(replay.sourceVersion, reposted.sourceVersion);
      assert.equal(replay.conflict, reposted.conflict);
      await assert.rejects(
        c.conflictResolution.resolve(
          reposted.id,
          {
            action: "ACCEPT_CANCELLATION",
            reason: "Недопустимое решение для повторного проведения",
            sourceVersion: reposted.sourceVersion,
          },
          c.admin.id,
        ),
        code("WAREHOUSE_RECEIPT_INVALID"),
      );
      await c.conflictResolution.resolve(
        reposted.id,
        {
          action: "KEEP_CURRENT",
          reason: "Новой физической поставки не было",
          sourceVersion: reposted.sourceVersion,
        },
        c.admin.id,
      );
      const kept = await snapshot(doc);
      assert.equal(kept.status, "CANCELLED");
      assert.equal(kept.conflict, null);
      assert.equal(kept.pendingSourceDocument, null);
      assert.equal(kept.sourceVersion, reposted.sourceVersion);
      assert.deepEqual(await stockBefore(), balances);
      const changed = await snapshot({ ...doc, number: "Reposted updated" });
      assert.equal(changed.conflict, "SOURCE_REPOSTED_AFTER_SETTLEMENT");
      assert.equal(changed.status, "CANCELLED");
      assert.deepEqual(await stockBefore(), balances);
    },
  );
}
