import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-issues-test-context.mjs";

export async function verifyWarehouseIssuesConcurrency(context) {
  const {
    prisma,
    fixture,
    payload,
    service,
    keeper,
    balanceQuantity,
    createBrokenService,
  } = context;
  const concurrent = await fixture(["10"]);
  const races = await Promise.allSettled([
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await balanceQuantity(concurrent.balances[0].id), "0");
  const atomic = await fixture(["10", "1"]);
  const beforeCount = await prisma.warehouseIssue.count();
  await assert.rejects(
    service.createIssue(payload(atomic, ["2", "2"]), keeper.id),
    code("WAREHOUSE_STOCK_INSUFFICIENT"),
  );
  assert.equal(await prisma.warehouseIssue.count(), beforeCount);
  assert.equal(await balanceQuantity(atomic.balances[0].id), "10");
  const broken = createBrokenService();
  const beforeAudit = await prisma.auditLog.count();
  await assert.rejects(
    broken.createIssue(
      {
        requestKey: randomUUID(),
        type: "MANUAL",
        positions: [
          { balanceId: String(atomic.balances[0].id), quantity: "2" },
        ],
      },
      keeper.id,
    ),
    /Issue audit unavailable/,
  );
  assert.equal(await prisma.warehouseIssue.count(), beforeCount);
  assert.equal(await prisma.auditLog.count(), beforeAudit);
  assert.equal(await balanceQuantity(atomic.balances[0].id), "10");
}
