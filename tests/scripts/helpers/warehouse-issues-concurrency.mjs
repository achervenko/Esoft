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
    projects,
    balanceQuantity,
    reserveQuantity,
    createBrokenService,
  } = context;
  const concurrent = await fixture(["10"]);
  const races = await Promise.allSettled([
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
    service.createIssue(payload(concurrent, ["10"]), keeper.id),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await balanceQuantity(concurrent.balances[0].id), "0");
  const atomic = await fixture(["10", "1"], [["5"], []]);
  const beforeCount = await prisma.warehouseIssue.count();
  await assert.rejects(
    service.createIssue(
      payload(atomic, ["2", "2"], { projectId: String(projects[0].id) }),
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_INSUFFICIENT_STOCK"),
  );
  assert.equal(await prisma.warehouseIssue.count(), beforeCount);
  assert.equal(await balanceQuantity(atomic.balances[0].id), "10");
  assert.equal(
    await reserveQuantity(atomic.balances[0].id, projects[0].id),
    "5",
  );
  const broken = createBrokenService();
  const beforeAudit = await prisma.auditLog.count();
  await assert.rejects(
    broken.createIssue(
      {
        requestKey: randomUUID(),
        type: "MANUAL",
        projectId: String(projects[0].id),
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
  assert.equal(
    await reserveQuantity(atomic.balances[0].id, projects[0].id),
    "5",
  );
}
