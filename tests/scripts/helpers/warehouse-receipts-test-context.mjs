import { createReceiptTestAuth } from "./warehouse-receipts-test-auth.mjs";
import { createReceiptTestAudit } from "./warehouse-receipts-test-audit.mjs";
import { createReceiptTestDomain } from "./warehouse-receipts-test-domain.mjs";
import { createReceiptTestIntegrations } from "./warehouse-receipts-test-integrations.mjs";
import { createReceiptTestHelpers } from "./warehouse-receipts-test-helpers.mjs";
export { code } from "./warehouse-receipts-test-helpers.mjs";

export async function createReceiptTestContext(prisma) {
  const audit = createReceiptTestAudit();
  const auth = createReceiptTestAuth(prisma);
  const domain = await createReceiptTestDomain(prisma, audit.audit);
  const integrations = createReceiptTestIntegrations(
    prisma,
    audit.audit,
    auth.machineKeys,
    domain.importer,
  );
  const helpers = await createReceiptTestHelpers(prisma, domain);
  return {
    prisma,
    ...audit,
    ...auth,
    ...domain,
    ...integrations,
    ...helpers,
  };
}
