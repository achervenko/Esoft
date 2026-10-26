import { createCatalogTestContext } from "./catalog-test-context.mjs";
import { verifyCatalogBasic } from "./catalog-basic.integration.mjs";
import { verifyCatalogConstraints } from "./catalog-constraints.integration.mjs";
import { verifyCatalogConcurrency } from "./catalog-concurrency.integration.mjs";
import { verifyCatalogAudit } from "./catalog-audit.integration.mjs";
import { verifyCatalogPermissions } from "./catalog-permissions.integration.mjs";
export async function verifyWarehouseCatalog(prisma, actor, test) {
  const context = createCatalogTestContext(prisma, actor);
  for (const [name, verify] of [
    [
      "basic: create, find, update, status, search and pagination",
      verifyCatalogBasic,
    ],
    [
      "constraints: duplicates, units in use, unknown fields and not found",
      verifyCatalogConstraints,
    ],
    ["concurrency: duplicate create", verifyCatalogConcurrency],
    [
      "audit: no-op, rollback and unique conflict propagation",
      verifyCatalogAudit,
    ],
    [
      "permissions: missing, banned, wrong role and admin",
      verifyCatalogPermissions,
    ],
  ])
    await test.test(name, () => verify(context));
}
