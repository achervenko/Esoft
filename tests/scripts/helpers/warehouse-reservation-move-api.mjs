import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { startReservationHttp } from "./warehouse-reservation-http-context.mjs";
import { createMoveApiFixture } from "./warehouse-reservation-move-api-fixture.mjs";
import { verifyMoveApiBasic } from "./warehouse-reservation-move-api-basic.mjs";
import { verifyMoveApiAccess } from "./warehouse-reservation-move-api-access.mjs";
import { verifyMoveApiAtomicity } from "./warehouse-reservation-move-api-atomicity.mjs";
import {
  verifyMoveApiConcurrency,
  verifyMoveApiReplays,
} from "./warehouse-reservation-move-api-concurrency.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  WarehouseTransfersService,
} = require("../../../backend/dist/src/warehouse/transfers/transfers.service.js");

export async function verifyReservationMoveApi(c, t) {
  const { manager, createOrder } = await createReservationFixture(c);
  const api = await startReservationHttp(c);
  const { request, admin, keeper } = api;
  const transfers = new WarehouseTransfersService(c.prisma, c.stock, c.audit);
  const fixture = createMoveApiFixture(c, manager, createOrder, request);
  try {
    const context = {
      request,
      admin,
      keeper,
      manager,
      transfers,
      createOrder,
      fixture,
    };
    await verifyMoveApiBasic(c, t, context);
    await verifyMoveApiAccess(c, t, context);
    await verifyMoveApiReplays(t, fixture);
    await verifyMoveApiAtomicity(c, t, fixture);
    await verifyMoveApiConcurrency(c, t, manager, transfers, admin, fixture);
  } finally {
    await api.close();
  }
}
