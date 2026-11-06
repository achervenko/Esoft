import {
  attachWarehousePackage,
  createReceiptFlowContext,
} from "./warehouse-receipt-flow-setup.mjs";
import { verifyWarehouseLinks } from "./warehouse-receipt-flow-warehouse-links.mjs";
import { verifyReceiptProcessing } from "./warehouse-receipt-flow-processing.mjs";
import { verifyWarehouseErrors } from "./warehouse-receipt-flow-warehouse-errors.mjs";

export async function verifyReceiptFlowOnCore(c, t) {
  await t.test(
    "core-only installation can later attach the real warehouse receipt handler without changing core",
    async (subtest) => {
      const attached = await attachWarehousePackage(c);
      const context = await createReceiptFlowContext(attached);
      try {
        await verifyWarehouseLinks(context, subtest);
        const processed = await verifyReceiptProcessing(context);
        await verifyWarehouseErrors(context, processed, subtest);
      } finally {
        await context.close();
      }
    },
  );
}
