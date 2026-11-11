import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createStockTestContext } from "./warehouse-stock-test-context.mjs";
export { hasCode } from "./warehouse-stock-test-context.mjs";
const require = createRequire(import.meta.url);
export function createTransfersTestRunner(prisma, database, t) {
  return (name, verify) =>
    t.test(name, async () => {
      const {
        WarehouseTransfersService,
      } = require("../../../backend/dist/src/warehouse/transfers/transfers.service.js");
      const ctx = await createStockTestContext(prisma, database);
      const {
        WarehouseStockOverviewService,
      } = require("../../../backend/dist/src/warehouse/stock/stock-overview.service.js");
      const overview = new WarehouseStockOverviewService(prisma);
      const audit = ctx.audit;
      const {
        WarehouseTransfersQueryService,
      } = require("../../../backend/dist/src/warehouse/transfers/transfers-query.service.js");
      const queries = new WarehouseTransfersQueryService(prisma);
      const service = new WarehouseTransfersService(
        prisma,
        ctx.stock,
        audit,
        queries,
      );
      const {
        WarehouseTransferConsolidationService,
      } = require("../../../backend/dist/src/warehouse/transfers/transfers-consolidation.service.js");
      const consolidation = new WarehouseTransferConsolidationService(
        prisma,
        ctx.stock,
        service,
      );
      const payload = (quantity = "2") => ({
        requestKey: randomUUID(),
        itemId: ctx.id,
        fromLocationId: ctx.loc(ctx.a),
        toLocationId: ctx.loc(ctx.b),
        quantity,
      });
      return verify({
        ...ctx,
        service,
        queries,
        consolidation,
        overview,
        payload,
        WarehouseTransfersService,
      });
    });
}
