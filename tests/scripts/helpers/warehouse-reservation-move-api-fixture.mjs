import { randomUUID } from "node:crypto";

export function createMoveApiFixture(c, manager, createOrder, request) {
  return async () => {
    const itemId = await c.newItem(randomUUID());
    const order = await createOrder(randomUUID());
    await c.receive(c.a, "12", itemId);
    const reserve = (quantity, orderId = order.id) =>
      c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId,
          orderId,
          locationId: c.loc(c.a),
          quantity,
        }),
      );
    const { reservation } = await reserve("8");
    const command = {
      requestKey: randomUUID(),
      fromLocationId: c.loc(c.a),
      toLocationId: c.loc(c.b),
      quantity: "3",
      comment: "  Перенос резерва  ",
    };
    const move = (body = command, expected = 201, role) =>
      request(
        "POST",
        "/" + reservation.id + "/move",
        expected === null ? undefined : expected,
        body,
        role,
      );
    const state = async () => ({
      reserve: await request("GET", "/" + reservation.id, 200),
      balances: await c.prisma.warehouseBalance.findMany({
        where: { itemId: BigInt(itemId) },
        orderBy: { storageLocationId: "asc" },
      }),
      transfers: await c.prisma.warehouseTransfer.count({
        where: { itemId: BigInt(itemId) },
      }),
      audit: await c.prisma.auditLog.count(),
    });
    return { itemId, order, reservation, reserve, command, move, state };
  };
}
