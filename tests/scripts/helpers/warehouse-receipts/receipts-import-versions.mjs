import assert from "node:assert/strict";
import { code } from "../warehouse-receipts-test-context.mjs";
import { createRequire } from "node:module";
const { AuditLogService } = createRequire(import.meta.url)(
  "../../../../backend/dist/src/audit/audit-log.service.js",
);

export async function receiptsImportVersions(c, t) {
  await t.test(
    "versions replay; safe increase; shrink after placement is a conflict",
    async (t) => {
      const doc = c.source();
      let r = await c.mapped(doc);
      assert.equal((await c.ingest(doc)).id, r.id);
      await c.place(r, "6");
      const increase = {
        ...doc,
        version: "2",
        lines: [{ ...doc.lines[0], quantity: "12" }],
      };
      r = await c.ingest(increase);
      assert.equal(r.lines[0].remaining, "6");
      const before = await c.quantity();
      r = await c.ingest({
        ...doc,
        version: "3",
        lines: [{ ...doc.lines[0], quantity: "4" }],
      });
      assert.equal(r.conflict, "SOURCE_LINES_CHANGED_AFTER_PLACEMENT");
      assert.equal(r.lines[0].quantity, "12");
      const appliedSnapshot = r.sourceDocument;
      const rejectedSnapshot = r.pendingSourceDocument;
      assert.equal(r.pendingSourceDocument.version, "3");
      assert.equal(await c.quantity(), before);
      await assert.rejects(c.place(r), code("WAREHOUSE_RECEIPT_BLOCKED"));
      assert.equal((await c.ingest(increase)).sourceVersion, "3");
      const realAudit = new AuditLogService(c.prisma);
      t.mock.method(
        c.audit,
        "writeFieldChanges",
        realAudit.writeFieldChanges.bind(realAudit),
      );
      await c.conflictResolution.resolve(
        r.id,
        {
          action: "KEEP_CURRENT",
          reason: "Разобрано вручную, оставляем физический факт",
          sourceVersion: "3",
        },
        c.admin.id,
      );
      const kept = await c.receipts.findOne(r.id);
      assert.equal(kept.conflict, null);
      assert.equal(kept.pendingSourceDocument, null);
      assert.deepEqual(kept.sourceDocument, appliedSnapshot);
      assert.equal(kept.sourceVersion, "3");
      assert.equal(await c.quantity(), before);
      const audit = await c.prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "warehouse_receipt",
          entityStringId: r.id,
          fieldName: "Ручное решение конфликта",
          userId: c.admin.id,
        },
      });
      const decision = JSON.parse(audit.newValue);
      assert.equal(decision.action, "KEEP_CURRENT");
      assert.equal(decision.sourceVersion, "3");
      assert.equal(
        decision.reason,
        "Разобрано вручную, оставляем физический факт",
      );
      assert.deepEqual(decision.rejectedSource, rejectedSnapshot);
      assert.equal(Object.hasOwn(decision, "acceptedSource"), false);
    },
  );
}
