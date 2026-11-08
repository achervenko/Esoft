import { createRequire } from "node:module";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { startReservationHttp } from "./warehouse-reservation-http-context.mjs";
import { verifyApiAccess } from "./warehouse-reservation-api-access.mjs";
import { verifyApiCommands } from "./warehouse-reservation-api-commands.mjs";
import {
  verifyApiList,
  verifyApiHistory,
} from "./warehouse-reservation-api-queries.mjs";
import { verifyApiConcurrency } from "./warehouse-reservation-api-concurrency.mjs";

const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
const reservations = (path) => load("warehouse/reservations/" + path);

export async function verifyReservationApi(c, t) {
  const { WarehouseReservationsService } = reservations(
    "reservations.service.js",
  );
  const { WarehouseReservationManager, manager, first, second, createOrder } =
    await createReservationFixture(c);
  const commands = new WarehouseReservationsService(c.prisma, manager);
  const closed = await c.prisma.customerOrder.update({
    where: { id: first.id },
    data: { status: "Закрыт" },
  });
  const api = await startReservationHttp(c);
  const { request, admin, keeper } = api;
  const input = {
    orderId: closed.id,
    itemId: c.id,
    locationId: c.loc(c.a),
    quantity: "3",
  };
  try {
    await c.receive(c.a, "10");
    await c.receive(c.b, "6");
    const context = {
      request,
      admin,
      keeper,
      input,
      closed,
      second,
      createOrder,
      commands,
      manager,
      WarehouseReservationManager,
      WarehouseReservationsService,
    };
    await verifyApiAccess(t, context);
    const id = await verifyApiCommands(c, t, context);
    await verifyApiList(c, t, context, id);
    await verifyApiConcurrency(c, t, context);
    await verifyApiHistory(c, t, context, id);
  } finally {
    await api.close();
  }
}
