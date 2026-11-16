import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { startReservationHttp } from "./warehouse-reservation-http-context.mjs";
import { verifyApiAccess } from "./warehouse-reservation-api-access.mjs";
import { verifyApiCommands } from "./warehouse-reservation-api-commands.mjs";
import {
  verifyApiList,
  verifyApiHistory,
} from "./warehouse-reservation-api-queries.mjs";
import { verifyApiConcurrency } from "./warehouse-reservation-api-concurrency.mjs";
import { verifyReservationOrdersApi } from "./warehouse-reservation-orders-api.mjs";

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
    await verifyReservationOrdersApi(c, t, context);
    await t.test(
      "reserves with partial or zero coverage and replays a concurrent create once",
      async () => {
        const order = await createOrder("manual-deficit");
        const payload = {
          orderId: order.id,
          itemId: c.id,
          quantity: "5",
          requestKey: randomUUID(),
        };
        const [first, replay] = await Promise.all([
          request("POST", "", 201, payload),
          request("POST", "", 201, payload),
        ]);
        assert.deepEqual(replay, first);
        assert.equal(first.quantity, "5");
        assert.equal(first.deficitQuantity, "5");
        assert.deepEqual(first.allocations, []);
        assert.equal(
          (await request("POST", "", 409, { ...payload, quantity: "6" })).code,
          "WAREHOUSE_RESERVATION_REQUEST_CONFLICT",
        );
        await c.receive(c.a, "10");
        const partial = await request("POST", "", 201, {
          ...payload,
          requestKey: randomUUID(),
          quantity: "4",
          coveredQuantity: "2",
          locationId: input.locationId,
        });
        assert.equal(partial.id, first.id);
        assert.equal(partial.quantity, "9");
        assert.equal(partial.coveredQuantity, "2");
        assert.deepEqual(await request("POST", "", 201, payload), first);
      },
    );
    await t.test(
      "increases demand independently or atomically with coverage",
      async () => {
        const order = await createOrder("demand-edit");
        await c.receive(c.a, "20");
        const created = await request("POST", "", 201, {
          ...input,
          orderId: order.id,
        });
        const path = `/${created.id}/demand/increase`;
        const change = {
          expectedQuantity: "3",
          quantity: "5",
          comment: "Увеличение потребности",
        };
        await request("POST", path, 403, change, "keeper");
        const demand = await request("POST", path, 201, change);
        assert.equal(demand.deficitQuantity, "2");
        const next = { ...change, expectedQuantity: "5", quantity: "6" };
        await request("POST", path, 409, {
          ...next,
          allocation: { locationId: input.locationId, quantity: "4" },
        });
        assert.equal(
          (await request("GET", `/${created.id}`, 200)).quantity,
          "5",
        );
        const combined = await request("POST", path, 201, {
          ...next,
          allocation: { locationId: input.locationId, quantity: "3" },
        });
        assert.equal(combined.quantity, "6");
        assert.equal(combined.coveredQuantity, "6");
        assert.equal(
          (await request("POST", path, 409, next)).code,
          "WAREHOUSE_RESERVATION_STALE_DEMAND",
        );
      },
    );
  } finally {
    await api.close();
  }
}
