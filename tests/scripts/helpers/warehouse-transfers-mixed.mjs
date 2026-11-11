import { createMixedTransferFixture } from "./warehouse-transfers-mixed-fixture.mjs";
import { verifyMixedConsolidation } from "./warehouse-transfers-mixed-consolidation.mjs";
import { verifyMixedBasics } from "./warehouse-transfers-mixed-basic.mjs";
import { verifyMixedValidation } from "./warehouse-transfers-mixed-validation.mjs";
import { verifyMixedAtomicity } from "./warehouse-transfers-mixed-atomicity.mjs";

export async function verifyMixedTransfers(c, t, context) {
  const fixture = createMixedTransferFixture(c, context);
  await verifyMixedConsolidation(c, t, context, fixture);
  await verifyMixedBasics(c, t, context, fixture);
  await verifyMixedValidation(t, context, fixture);
  await verifyMixedAtomicity(c, t, context, fixture);
}
