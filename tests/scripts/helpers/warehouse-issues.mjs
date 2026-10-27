import { verifyWarehouseIssuesHistory } from "./warehouse-issues-history.mjs";
import { verifyWarehouseIssuesWarehouses } from "./warehouse-issues-warehouses.mjs";
import { createWarehouseIssuesTestContext } from "./warehouse-issues-test-context.mjs";
import { verifyWarehouseIssuesBasic } from "./warehouse-issues.basic.mjs";
import { verifyWarehouseIssuesOverride } from "./warehouse-issues.override.mjs";
import { verifyWarehouseIssuesSheets } from "./warehouse-issues-sheets.mjs";
import { verifyWarehouseIssuesConcurrency } from "./warehouse-issues-concurrency.mjs";
import { verifyWarehouseIssuesIdempotency } from "./warehouse-issues-idempotency.mjs";

export async function verifyWarehouseIssues(prisma, test) {
  for (const [name, verify] of [
    [
      "historical snapshots, search, retention and year-old issues",
      verifyWarehouseIssuesHistory,
    ],
    [
      "warehouse boundaries, address identity and filters",
      verifyWarehouseIssuesWarehouses,
    ],
    [
      "basic availability, issues, filters and permissions",
      verifyWarehouseIssuesBasic,
    ],
    [
      "override preview, confirmation and foreign reservations",
      verifyWarehouseIssuesOverride,
    ],
    [
      "issue sheets, partial execution and finalization",
      verifyWarehouseIssuesSheets,
    ],
    ["concurrent issues and atomic rollback", verifyWarehouseIssuesConcurrency],
    [
      "idempotency, replay, request conflicts and permissions",
      verifyWarehouseIssuesIdempotency,
    ],
  ]) {
    const run = async () =>
      verify(await createWarehouseIssuesTestContext(prisma));
    if (test) await test.test(name, run);
    else await run();
  }
}
