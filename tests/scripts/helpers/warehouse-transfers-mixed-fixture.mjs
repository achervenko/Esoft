import { randomUUID } from "node:crypto";

export function createMixedTransferFixture(c, { manager, createOrder }) {
  return async () => {
    const itemId = await c.newItem(randomUUID());
    await c.receive(c.a, "12", itemId);
    const reservations = [];
    for (const quantity of ["4", "3"]) {
      const order = await createOrder(randomUUID());
      const { reservation } = await c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId,
          orderId: order.id,
          locationId: c.loc(c.a),
          quantity,
        }),
      );
      reservations.push(reservation);
    }
    const command = {
      requestKey: randomUUID(),
      itemId,
      fromLocationId: c.loc(c.a),
      toLocationId: c.loc(c.b),
      quantity: "8",
      comment: "Mixed transfer",
      distribution: {
        freeQuantity: "3",
        reservations: [
          { reservationId: reservations[0].id, quantity: "3" },
          { reservationId: reservations[1].id, quantity: "2" },
        ],
      },
    };
    const state = async () => ({
      balances: await c.prisma.warehouseBalance.findMany({
        where: { itemId: BigInt(itemId) },
        orderBy: { storageLocationId: "asc" },
      }),
      reservations: await c.prisma.warehouseReservation.findMany({
        where: { itemId: BigInt(itemId) },
        include: { allocations: { orderBy: { locationId: "asc" } } },
        orderBy: { id: "asc" },
      }),
      transfers: await c.prisma.warehouseTransfer.count({
        where: { itemId: BigInt(itemId) },
      }),
    });
    return { itemId, reservations, command, state };
  };
}
