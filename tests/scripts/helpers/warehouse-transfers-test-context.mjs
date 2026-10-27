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
      const {
        WarehouseReservationsService,
      } = require("../../../backend/dist/src/warehouse/reservations/reservations.service.js");
      const {
        WarehouseReservationsApiService,
      } = require("../../../backend/dist/src/warehouse/reservations/reservations-api.service.js");
      const ctx = await createStockTestContext(prisma, database);
      const audit = ctx.audit;
      const reservations = new WarehouseReservationsService(audit);
      const service = new WarehouseTransfersService(
        prisma,
        ctx.stock,
        reservations,
        audit,
      );
      const reservationsApi = new WarehouseReservationsApiService(
        prisma,
        ctx.stock,
        reservations,
        audit,
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
        reservations,
        reservationsApi,
        payload,
        WarehouseTransfersService,
      });
    });
}
