import test from "node:test";
import {
  createAdjustmentsTestEnvironment,
  withAdjustmentsContext,
} from "../../helpers/warehouse-adjustments/adjustments-test-context.mjs";
import { verify as verifySchema } from "../../helpers/warehouse-adjustments/adjustments-schema.spec.mjs";
import { verify as verifyBasic } from "../../helpers/warehouse-adjustments/adjustments-basic.spec.mjs";
import { verify as verifyAccess } from "../../helpers/warehouse-adjustments/adjustments-access.spec.mjs";
import { verify as verifyIdempotency } from "../../helpers/warehouse-adjustments/adjustments-idempotency.spec.mjs";
import { verify as verifyCounting } from "../../helpers/warehouse-adjustments/adjustments-counting.spec.mjs";
import { verify as verifyDocuments } from "../../helpers/warehouse-adjustments/adjustments-documents.spec.mjs";
import { verify as verifyRollback } from "../../helpers/warehouse-adjustments/adjustments-rollback.spec.mjs";
import { verify as verifyStaging } from "../../helpers/warehouse-adjustments/storage-staging.spec.mjs";
import { verify as verifyGenericOwner } from "../../helpers/warehouse-adjustments/storage-generic-owner.spec.mjs";

test(
  "administrative adjustments and generic staged storage are atomic and preserve project demand",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async (t) => {
    const environment = await createAdjustmentsTestEnvironment();
    let next = 0;
    try {
      const run = (name, testCase, options) =>
        t.test(name, () =>
          withAdjustmentsContext(
            environment,
            `adjustments_${String.fromCharCode(97 + next++)}`,
            testCase,
            options,
          ),
        );
      await verifySchema(run);
      await verifyBasic(run);
      await verifyAccess(run);
      await verifyIdempotency(run);
      await verifyCounting(run);
      await verifyDocuments(run);
      await verifyRollback(run);
      await verifyStaging(run);
      await verifyGenericOwner(run);
    } finally {
      await environment.close();
    }
  },
);
