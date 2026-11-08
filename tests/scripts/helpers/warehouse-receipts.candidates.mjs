import { receiptsCandidatesFilter } from "./receipts-candidates-filter.test.mjs";
import { receiptsCandidatesReconciliation } from "./receipts-candidates-reconciliation.test.mjs";

export async function receiptsCandidates(prisma, t) {
  await receiptsCandidatesFilter(prisma, t);
  await receiptsCandidatesReconciliation(prisma, t);
}
