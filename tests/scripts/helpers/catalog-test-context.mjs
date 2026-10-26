import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function createCatalogTestContext(prisma, actor) {
  const {
    WarehouseCatalogService,
  } = require("../../../backend/dist/src/warehouse/catalog/catalog.service.js");
  const {
    AuditLogService,
  } = require("../../../backend/dist/src/audit/audit-log.service.js");
  const audit = new AuditLogService(prisma);
  const service = new WarehouseCatalogService(prisma, audit);
  const create = (article, extra = {}) =>
    service.create(
      { article, name: "Подшипник", unit: "шт", ...extra },
      actor.id,
    );
  return { prisma, actor, service, create, WarehouseCatalogService };
}
