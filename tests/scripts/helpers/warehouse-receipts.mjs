import { receiptsDisplay } from "./warehouse-receipts.display.mjs";
import { receiptsCandidates } from "./warehouse-receipts.candidates.mjs";
import { receiptsLifecycle } from "./warehouse-receipts.lifecycle.mjs";
import { receiptsCatalogBoundary } from "./warehouse-receipts.catalog.mjs";
import { createReceiptTestContext } from "./warehouse-receipts-test-context.mjs";
import { receiptsManual } from "./receipts-manual.test.mjs";
import { receiptsPlacement } from "./receipts-placement.test.mjs";
import { receiptsList } from "./receipts-list.test.mjs";
import { receiptsImport } from "./warehouse-receipts/receipts-import.mjs";
import { receiptsEvents } from "./warehouse-receipts.events.mjs";
import { receiptsKeys } from "./warehouse-receipts.keys.mjs";
import { receiptsKeyAtomicity } from "./warehouse-receipts.keys-atomicity.mjs";
export async function verifyReceipts(prisma, database, t) {
  const context = await createReceiptTestContext(prisma);
  await receiptsManual(context, t);
  await receiptsPlacement(context, t);
  await receiptsList(context, t);
  await receiptsImport(context, t);
  await receiptsEvents(context, t);
  await receiptsKeys(context, t);
  await receiptsKeyAtomicity(context, t);
  await receiptsCatalogBoundary(context, t);
  await receiptsDisplay(context, t);
  await receiptsCandidates(prisma, t);
  await receiptsLifecycle(await createReceiptTestContext(prisma), t);
}
