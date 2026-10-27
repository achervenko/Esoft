import assert from "node:assert/strict";
import { code } from "./warehouse-issue-sheets-test-context.mjs";

export async function verifyIssueSheetsAtomicity(context) {
  const {
    prisma,
    service,
    queries,
    actor,
    item,
    balance,
    create,
    add,
    issue,
    stockQuantity,
    makeService,
    WarehouseIssueSheetTransactions,
  } = context;
  const atomic = await create("Атомарность");
  const atomicLine = await add(atomic, "5");
  await service.markReady(atomic.id, actor.id);
  const beforeAtomic = await stockQuantity();
  for (const isolationLevel of ["RepeatableRead", "Serializable"]) {
    let callbackCalled = false;
    await assert.rejects(
      prisma.$transaction(
        (tx) =>
          service.executeIssueForLine(
            tx,
            atomicLine.id,
            String(item.id),
            "1",
            actor.id,
            async () => {
              callbackCalled = true;
            },
          ),
        { isolationLevel },
      ),
      code("WAREHOUSE_ISSUE_SHEET_ISOLATION_REQUIRED"),
    );
    assert.equal(callbackCalled, false);
  }
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );
  await assert.rejects(
    issue(atomicLine, "1", { projectId: null }),
    code("WAREHOUSE_ISSUE_SHEET_ISSUE_MISMATCH"),
  );
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );
  const broken = makeService(
    new WarehouseIssueSheetTransactions(prisma, {
      writeFieldChanges: async () => {
        throw new Error("Audit unavailable");
      },
    }),
  );
  await assert.rejects(
    broken.finalize(atomic.id, actor.id),
    /Audit unavailable/,
  );
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  const issuesBeforeAuditFailure = await prisma.warehouseIssue.count();
  const positionsBeforeAuditFailure =
    await prisma.warehouseIssuePosition.count();
  const auditBeforeIssueFailure = await prisma.auditLog.count();
  let observedIssueBeforeAuditFailure = false;
  const failingIssueAudit = makeService(
    new WarehouseIssueSheetTransactions(prisma, {
      writeFieldChanges: async ({ tx }) => {
        assert.equal(
          (
            await tx.warehouseBalance.findUniqueOrThrow({
              where: { id: balance.id },
            })
          ).quantity.toString(),
          (await import("@prisma/client")).Prisma.Decimal.sub(
            beforeAtomic,
            "1",
          ).toString(),
        );
        assert.equal(
          await tx.warehouseIssue.count(),
          issuesBeforeAuditFailure + 1,
        );
        assert.equal(
          await tx.warehouseIssuePosition.count(),
          positionsBeforeAuditFailure + 1,
        );
        assert.equal(
          (
            await tx.warehouseIssueSheet.findUniqueOrThrow({
              where: { id: BigInt(atomic.id) },
            })
          ).status,
          "IN_PROGRESS",
        );
        observedIssueBeforeAuditFailure = true;
        throw new Error("Issue transition audit unavailable");
      },
    }),
  );
  await assert.rejects(
    issue(atomicLine, "1", {}, failingIssueAudit),
    /Issue transition audit unavailable/,
  );
  assert.equal(observedIssueBeforeAuditFailure, true);
  assert.equal(await stockQuantity(), beforeAtomic);
  assert.equal(await prisma.warehouseIssue.count(), issuesBeforeAuditFailure);
  assert.equal(
    await prisma.warehouseIssuePosition.count(),
    positionsBeforeAuditFailure,
  );
  assert.equal(await prisma.auditLog.count(), auditBeforeIssueFailure);
  assert.equal((await queries.findOne(atomic.id)).status, "READY");
  assert.equal(
    (await queries.lines(atomic.id, {})).items[0].issuedQuantity,
    "0",
  );
}
