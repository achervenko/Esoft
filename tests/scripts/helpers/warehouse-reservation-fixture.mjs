import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function createReservationFixture(c) {
  const {
    WarehouseReservationManager,
  } = require("../../../backend/dist/src/warehouse/reservations/reservation-manager.service.js");
  const manager = new WarehouseReservationManager(c.audit, c.stock);
  const source = await c.prisma.integrationSource.create({
    data: {
      id: randomUUID(),
      code: randomUUID(),
      name: "Reservation test source",
      actorUserId: c.actor.id,
      systemType: "ONE_C",
      baseUrl: "https://example.invalid",
      authorizationEncrypted: "fixture",
    },
  });
  const createOrder = (number) =>
    c.prisma.customerOrder.create({
      data: {
        id: randomUUID(),
        sourceId: source.id,
        number,
        name: "",
        documentDate: "2026-11-08T00:00:00",
        status: "КОбеспечению",
        posted: true,
        deletionMark: false,
        checkedAt: new Date(),
        changedAt: new Date(),
      },
    });
  const first = await createOrder("1"),
    second = await createOrder("2");
  const input = (location, quantity, orderId = first.id) => ({
    itemId: c.id,
    orderId,
    locationId: c.loc(location),
    quantity,
  });
  const reserve = (value) =>
    c.transaction((ctx) => manager.reserve(ctx, value));
  const assertStoredTotal = async (id, expected) => {
    const row = await c.prisma.warehouseReservation.findUniqueOrThrow({
      where: { id },
      include: { allocations: true },
    });
    const total = row.allocations.reduce(
      (sum, allocation) => sum.plus(allocation.quantity),
      new c.Prisma.Decimal(0),
    );
    assert.equal(row.quantity.toString(), expected);
    assert.equal(total.toString(), expected);
    return row;
  };

  return {
    WarehouseReservationManager,
    manager,
    createOrder,
    first,
    second,
    input,
    reserve,
    assertStoredTotal,
  };
}
