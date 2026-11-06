import { verifyActorPermissions } from "./integrations/integrations-core-permissions.test.mjs";
import test from "node:test";
import { createIntegrationsCoreContext } from "./integrations/integrations-core-context.mjs";
import { verifyReceiptFlowOnCore } from "../../helpers/warehouse-receipt-flow/warehouse-receipt-flow-on-core.mjs";
import { verifySources } from "./integrations/integrations-core-sources.test.mjs";
import { verifyKeys } from "./integrations/integrations-core-keys.test.mjs";
import { verifyEvents } from "./integrations/integrations-core-events.test.mjs";
import { verifyWorker } from "./integrations/integrations-core-worker.test.mjs";
import { verifyRetry } from "./integrations/integrations-core-retry.test.mjs";
import {
  verifyAtomicity,
  verifyAtomicSourceSettings,
} from "./integrations/integrations-core-atomicity.test.mjs";

test(
  "core integrations: real database, keys, two flows, delivery and leased execution",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async (t) => {
    const c = await createIntegrationsCoreContext();
    try {
      await verifySources(c, t);
      await verifyKeys(c, t);
      await verifyEvents(c, t);
      await verifyWorker(c, t);
      await verifyRetry(c, t);
      await verifyAtomicity(c, t);
      await verifyAtomicSourceSettings(c, t);
      await verifyActorPermissions(c, t);
      await verifyReceiptFlowOnCore(c, t);
    } finally {
      await c.close();
    }
  },
);
