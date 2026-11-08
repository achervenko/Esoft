import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function createCoverageFixture(c, manager, createOrder) {
  const itemId = await c.newItem(randomUUID());
  const order = await createOrder(randomUUID());
  await c.receive(c.a, "10", itemId);
  await c.receive(c.b, "2", itemId);
  const reserve = (location, quantity, orderId = order.id) =>
    c.transaction((ctx) =>
      manager.reserve(ctx, {
        itemId,
        orderId,
        locationId: c.loc(location),
        quantity,
      }),
    );
  const { reservation } = await reserve(c.a, "8");
  const command = (location, quantity, reservationId = reservation.id) => ({
    reservationId,
    locationId: c.loc(location),
    quantity,
  });
  const reduce = (location, quantity) =>
    c.transaction((ctx) =>
      manager.reduceCoverage(ctx, command(location, quantity)),
    );
  const restore = (location, quantity, id) =>
    c.transaction((ctx) =>
      manager.restoreCoverage(ctx, command(location, quantity, id)),
    );
  const history = () =>
    c.prisma.auditLog.findMany({
      where: {
        entityType: "warehouse_reservation",
        entityStringId: reservation.id,
      },
      orderBy: { id: "asc" },
    });
  const state = async (quantity, expected, id = reservation.id) => {
    const row = await c.prisma.warehouseReservation.findUniqueOrThrow({
      where: { id },
      include: { allocations: true },
    });
    assert.equal(row.quantity.toString(), quantity);
    assert.deepEqual(
      Object.fromEntries(
        row.allocations.map((a) => [String(a.locationId), String(a.quantity)]),
      ),
      Object.fromEntries(
        expected.map(([location, amount]) => [c.loc(location), amount]),
      ),
    );
    const deficit = row.allocations.reduce(
      (left, allocation) => left.minus(allocation.quantity),
      row.quantity,
    );
    assert.ok(deficit.gte(0));
    return deficit.toString();
  };
  return {
    itemId,
    order,
    reservation,
    reserve,
    command,
    reduce,
    restore,
    history,
    state,
  };
}
