import { verifyReceiptOrderBasics } from "./warehouse-receipt-orders-basic.mjs";
import { verifyReceiptOrderRequests } from "./warehouse-receipt-orders-requests.mjs";
import { createReceiptOrderFixture } from "./warehouse-receipt-orders-fixture.mjs";
import { verifyReceiptOrderAtomicity } from "./warehouse-receipt-orders-atomicity.mjs";
import { verifyReceiptOrderConcurrency } from "./warehouse-receipt-orders-concurrency.mjs";

export async function verifyReceiptOrders(c, t) {
  const context = await createReceiptOrderFixture(c);
  try {
    await verifyReceiptOrderBasics(c, t, context);
    await verifyReceiptOrderRequests(c, t, context);
    await verifyReceiptOrderAtomicity(c, t, context);
    await verifyReceiptOrderConcurrency(c, t, context);
  } finally {
    await context.close();
  }
}
