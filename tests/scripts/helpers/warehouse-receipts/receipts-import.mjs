import { receiptsImportMapping } from "./receipts-import-mapping.mjs";
import { receiptsImportVersions } from "./receipts-import-versions.mjs";
import { receiptsImportCancellation } from "./receipts-import-cancellation.mjs";
import { receiptsImportReconciliation } from "./receipts-import-reconciliation.mjs";
import { receiptsImportQueries } from "./receipts-import-queries.mjs";
import { receiptsImportRaces } from "./receipts-import-races.mjs";

export async function receiptsImport(c, t) {
  await receiptsImportMapping(c, t);
  await receiptsImportVersions(c, t);
  await receiptsImportCancellation(c, t);
  await receiptsImportReconciliation(c, t);
  await receiptsImportQueries(c, t);
  await receiptsImportRaces(c, t);
}
