import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMixedConsolidation(
  c,
  t,
  { manager, request },
  fixture,
) {
  await t.test(
    "HTTP consolidation moves all free stock and order allocations, with atomic rollback and replay",
    async () => {
      const f = await fixture();
      const secondSource = await c.prisma.warehouseStorageLocation.create({
        data: { warehouseId: c.a.warehouseId, name: randomUUID() },
      });
      await c.receive(secondSource, "2", f.itemId);
      await c.transaction((ctx) =>
        manager.reserve(ctx, {
          itemId: f.itemId,
          orderId: f.reservations[0].orderId,
          locationId: c.loc(secondSource),
          quantity: "2",
        }),
      );
      const target = c.b;
      const path = "/api/warehouse/transfers/consolidate";
      const payload = {
        requestKey: randomUUID(),
        itemId: f.itemId,
        fromWarehouseId: String(c.a.warehouseId),
        toLocationId: c.loc(target),
        moves: [
          {
            fromLocationId: c.loc(c.a),
            quantity: "12",
            distribution: {
              freeQuantity: "5",
              reservations: [
                { reservationId: f.reservations[0].id, quantity: "4" },
                { reservationId: f.reservations[1].id, quantity: "3" },
              ],
            },
          },
          {
            fromLocationId: c.loc(secondSource),
            quantity: "2",
            distribution: {
              freeQuantity: "0",
              reservations: [
                { reservationId: f.reservations[0].id, quantity: "2" },
              ],
            },
          },
        ],
      };
      const before = await f.state();
      await request("POST", path, 403, payload, "keeper");
      const moves = [...payload.moves].sort((a, b) =>
        a.fromLocationId.localeCompare(b.fromLocationId),
      );
      const last = moves[1];
      const failed = await request("POST", path, 409, {
        ...payload,
        moves: [
          moves[0],
          {
            ...last,
            distribution: {
              freeQuantity: "0",
              reservations: [
                { reservationId: randomUUID(), quantity: last.quantity },
              ],
            },
          },
        ],
      });
      assert.equal(failed.code, "WAREHOUSE_TRANSFER_RESERVATION_INVALID");
      assert.deepEqual(await f.state(), before);

      const result = await request("POST", path, 201, payload);
      assert.equal(result.ids.length, 2);
      const after = await f.state();
      assert.equal(after.transfers, 2);
      assert.equal(
        after.balances
          .find((b) => b.storageLocationId === target.id)
          .quantity.toString(),
        "14",
      );
      assert.ok(
        after.balances
          .filter((b) => b.storageLocationId !== target.id)
          .every((b) => b.quantity.isZero()),
      );
      for (const reservation of after.reservations) {
        const original = before.reservations.find(
          (r) => r.id === reservation.id,
        );
        assert.equal(reservation.orderId, original.orderId);
        assert.equal(
          reservation.quantity.toString(),
          original.quantity.toString(),
        );
        assert.deepEqual(
          reservation.allocations.map((a) => [
            a.locationId,
            a.quantity.toString(),
          ]),
          [[target.id, original.quantity.toString()]],
        );
      }
      const replay = await request("POST", path, 201, {
        ...payload,
        moves: payload.moves
          .map((move) => ({
            ...move,
            distribution: {
              ...move.distribution,
              reservations: [...move.distribution.reservations].reverse(),
            },
          }))
          .reverse(),
      });
      assert.deepEqual(replay, result);
      const conflict = await request("POST", path, 409, {
        ...payload,
        moves: [
          {
            ...payload.moves[0],
            distribution: {
              freeQuantity: "12",
              reservations: [],
            },
          },
          payload.moves[1],
        ],
      });
      assert.equal(conflict.code, "WAREHOUSE_TRANSFER_REQUEST_CONFLICT");
      assert.deepEqual(await f.state(), after);
    },
  );
}
