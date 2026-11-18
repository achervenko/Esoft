import { createReceiptPeriodFixture } from "./warehouse-receipts-period-fixture.mjs";
import { verifyReceiptPeriodHistory } from "./warehouse-receipts-period-history.mjs";
import { verifyReceiptPeriodLocks } from "./warehouse-receipts-period-locks.mjs";
import {
  verifyReceiptPeriodPlacement,
  verifyScheduledOlderReceipt,
} from "./warehouse-receipts-period-placement.mjs";
import { verifyReceiptPeriodPlacementRace } from "./warehouse-receipts-period-placement-race.mjs";
import { verifyInvoiceScheduler } from "./warehouse-invoice-scheduler.mjs";

export async function verifyOneCInvoicePeriod(c, t) {
  await t.test(
    "period imports share receipt identity and immutable history across HTTP connections",
    async (t) => {
      const fixture = await createReceiptPeriodFixture(c);
      try {
        const baseline = await verifyReceiptPeriodHistory(c, fixture);
        await verifyReceiptPeriodLocks(c, t, fixture, baseline.first);
        const linkedOrder = await verifyReceiptPeriodPlacement(
          c,
          fixture,
          baseline,
        );
        await verifyReceiptPeriodPlacementRace(c, t, fixture, linkedOrder);
        await verifyScheduledOlderReceipt(c, t, fixture, linkedOrder);
        await verifyInvoiceScheduler(c, t, fixture.a);
      } finally {
        await fixture.close();
      }
    },
  );
}
