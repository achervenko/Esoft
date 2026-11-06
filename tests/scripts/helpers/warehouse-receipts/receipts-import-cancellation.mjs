import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { code } from "../warehouse-receipts-test-context.mjs";
import { createRequire } from "node:module";
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
        c.admin.id,
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
          userId: c.admin.id,
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
    "admin settlement links fact corrections atomically without changing stock twice",
    async () => {
      const doc = c.source();
      let receipt = await c.mapped(doc);
      await c.place(receipt, "2");
      receipt = await c.ingest({ ...doc, version: "2", status: "CANCELLED" });
      const placements = await c.prisma.warehouseReceiptPlacement.findMany({
        where: { receiptLineId: BigInt(receipt.lines[0].id) },
      });
      const balance = await c.prisma.warehouseBalance.findUniqueOrThrow({
        where: {
          itemId_storageLocationId: {
            itemId: BigInt(receipt.lines[0].itemId),
            storageLocationId: placements[0].storageLocationId,
          },
        },
      });
      const adjustment = await c.prisma.warehouseStockAdjustment.create({
        data: {
          balanceId: balance.id,
          type: "WRITE_OFF",
          quantity: "2",
          quantityBefore: balance.quantity,
          quantityAfter: balance.quantity.minus(2),
          reason: "Исправление факта после отмены",
          requestKey: randomUUID(),
          requestHash: "a".repeat(64),
          createdByUserId: c.admin.id,
        },
      });
      await c.prisma.warehouseBalance.update({
        where: { id: balance.id },
        data: { quantity: adjustment.quantityAfter },
      });
      const before = await c.quantity();
      const body = {
        action: "RECONCILE_CANCELLATION",
        sourceVersion: "2",
        reason: "Ошибка приёмки исправлена по факту",
        adjustmentIds: [String(adjustment.id)],
      };
      await assert.rejects(
        c.conflictResolution.resolve(receipt.id, body, c.keeper.id),
        code("FORBIDDEN"),
      );
      const { WarehouseReceiptConflictResolutionService } = createRequire(
        import.meta.url,
      )(
        "../../../../backend/dist/src/warehouse/receipts/receipt-conflict-resolution.service.js",
      );
      const failing = new WarehouseReceiptConflictResolutionService(c.prisma, {
        writeFieldChanges: async () => {
          throw Error("audit failed");
        },
      });
      await assert.rejects(
        failing.resolve(receipt.id, body, c.admin.id),
        /audit failed/,
      );
      assert.equal(
        (
          await c.prisma.warehouseStockAdjustment.findUniqueOrThrow({
            where: { id: adjustment.id },
          })
        ).resolvedReceiptId,
        null,
      );
      assert.equal(
        (
          await c.prisma.warehouseReceipt.findUniqueOrThrow({
            where: { id: BigInt(receipt.id) },
          })
        ).conflict,
        "SOURCE_CANCELLED_AFTER_PLACEMENT",
      );
      await assert.rejects(
        c.conflictResolution.resolve(
          receipt.id,
          { ...body, adjustmentIds: ["9223372036854775807"] },
          c.admin.id,
        ),
        code("WAREHOUSE_RECEIPT_ADJUSTMENT_INVALID"),
      );
      await assert.rejects(
        c.conflictResolution.resolve(
          receipt.id,
          { ...body, sourceVersion: "1" },
          c.admin.id,
        ),
        code("WAREHOUSE_RECEIPT_CONFLICT_STALE"),
      );
      await c.conflictResolution.resolve(receipt.id, body, c.admin.id);
      const accepted = await c.receipts.findOne(receipt.id);
      assert.equal(accepted.status, "CANCELLED");
      assert.equal(accepted.conflict, null);
      assert.equal(accepted.settlementAdjustments[0].id, String(adjustment.id));
      assert.equal(await c.quantity(), before);
      assert.equal(
        await c.prisma.warehouseReceiptPlacement.count({
          where: { receiptLineId: BigInt(receipt.lines[0].id) },
        }),
        1,
      );
      await assert.rejects(
        c.conflictResolution.resolve(receipt.id, body, c.admin.id),
        code("WAREHOUSE_RECEIPT_CONFLICT_STALE"),
      );
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
      assert.equal(await c.quantity(), before);
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
      assert.equal(await c.quantity(), before);
      const changed = await snapshot({ ...doc, number: "Reposted updated" });
      assert.equal(changed.conflict, "SOURCE_REPOSTED_AFTER_SETTLEMENT");
      assert.equal(changed.status, "CANCELLED");
      assert.equal(await c.quantity(), before);
    },
  );
}
