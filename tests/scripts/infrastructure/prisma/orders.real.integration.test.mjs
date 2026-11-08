import { verifyBatching } from "./orders/orders-sync.batching.spec.mjs";
import test from "node:test";
import { createOrdersSyncContext } from "./orders/orders-sync.test-context.mjs";
import {
  verifyBasic,
  verifyListFilters,
} from "./orders/orders-sync.basic.spec.mjs";
import { verifyAtomicity } from "./orders/orders-sync.atomicity.spec.mjs";
import {
  verifySourceIsolation,
  verifySourceSwitch,
} from "./orders/orders-sync.identity.spec.mjs";
import { verifyMissing } from "./orders/orders-sync.missing.spec.mjs";
import { verifySample } from "./orders/orders-sync.sample.spec.mjs";
import { verifyAccess } from "./orders/orders-sync.access.spec.mjs";
test(
  "orders mirror on isolated core database and real HTTP",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async (t) => {
    const context = await createOrdersSyncContext();
    try {
      await verifyBasic(context, t);
      await verifyAtomicity(context, t);
      await verifySourceIsolation(context, t);
      await verifyMissing(context, t);
      await verifySample(context, t);
      await verifyAccess(context, t);
      await verifySourceSwitch(context, t);
      await verifyListFilters(context, t);
      await verifyBatching(context, t);
    } finally {
      await context.close();
    }
  },
);
