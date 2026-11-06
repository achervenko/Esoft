import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function createCatalogTestContext(prisma, actor) {
  const {
    WarehouseCatalogService,
  } = require("../../../backend/dist/src/warehouse/catalog/catalog.service.js");
  const {
    AuditLogService,
  } = require("../../../backend/dist/src/audit/audit-log.service.js");
  const {
    WarehouseCatalogUsagePolicy,
  } = require("../../../backend/dist/src/warehouse/catalog/catalog-usage.policy.js");
  const usage = new WarehouseCatalogUsagePolicy();
  const audit = new AuditLogService(prisma);
  const service = new WarehouseCatalogService(prisma, audit, usage);
  const create = (article, extra = {}) =>
    service.create(
      { article, name: "Подшипник", unit: "шт", ...extra },
      actor.id,
    );
  return { prisma, actor, service, create, WarehouseCatalogService, usage };
}
