import { createIssueSheetsTestContext } from "./warehouse-issue-sheets-test-context.mjs";
import { verifyIssueSheetsBasic } from "./warehouse-issue-sheets.basic.mjs";
import { verifyIssueSheetsExecution } from "./warehouse-issue-sheets.execution.mjs";
import { verifyIssueSheetsQuery } from "./warehouse-issue-sheets.query.mjs";
import { verifyIssueSheetsConcurrency } from "./warehouse-issue-sheets.concurrency.mjs";
import { verifyIssueSheetsAtomicity } from "./warehouse-issue-sheets.atomicity.mjs";
import { verifyIssueSheetsEditing } from "./warehouse-issue-sheets.editing.mjs";

export async function verifyIssueSheets(prisma, test) {
  for (const [name, verify] of [
    ["basic", verifyIssueSheetsBasic],
    ["execution", verifyIssueSheetsExecution],
    ["query", verifyIssueSheetsQuery],
    ["concurrency", verifyIssueSheetsConcurrency],
    ["atomicity", verifyIssueSheetsAtomicity],
    ["editing", verifyIssueSheetsEditing],
  ]) {
    const run = async () => verify(await createIssueSheetsTestContext(prisma));
    if (test) await test.test(name, run);
    else await run();
  }
}
