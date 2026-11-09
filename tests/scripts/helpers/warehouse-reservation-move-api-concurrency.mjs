import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMoveApiConcurrency(
  c,
  t,
  manager,
  transfers,
  admin,
  fixture,
) {
  await t.test(
    "reserved HTTP moves compete safely with ordinary transfers and reservation commands",
    async () => {
      for (const operation of ["reserve", "decrease", "consume", "ordinary"]) {
        const f = await fixture();
        const reservationId = f.reservation.id;
        let rival;
        if (operation === "ordinary") {
          rival = transfers.create(
            {
              ...f.command,
              itemId: f.itemId,
              requestKey: randomUUID(),
              quantity: "4",
            },
            admin.id,
          );
        } else {
          rival = c.transaction((ctx) => {
            switch (operation) {
              case "reserve":
                return manager.reserve(ctx, {
                  orderId: f.order.id,
                  itemId: f.itemId,
                  locationId: c.loc(c.a),
                  quantity: "4",
                });
              case "decrease":
                return manager.decrease(ctx, {
                  reservationId,
                  allocations: [{ locationId: c.loc(c.a), quantity: "6" }],
                  deficitQuantity: "0",
                });
              default:
                return manager.consume(ctx, {
                  reservationId,
                  locationId: c.loc(c.a),
                  quantity: "6",
                });
            }
          });
        }
        const [http, internal] = await Promise.all([
          f.move(
            { ...f.command, quantity: operation === "ordinary" ? "8" : "4" },
            null,
          ),
          Promise.resolve(rival).then(
            (value) => ({ value }),
            (error) => ({ error }),
          ),
        ]);
        if (["reserve", "ordinary"].includes(operation)) {
          assert.equal(http.status, 201);
          assert.equal(internal.error, undefined);
        } else {
          assert.equal(
            Number(http.status === 201) + Number(!internal.error),
            1,
          );
          if (internal.error) assert.equal(internal.error.getStatus(), 409);
          else
            assert.equal(
              http.result.code,
              "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
            );
        }
        const state = await f.state();
        const allocations =
          await c.prisma.warehouseReservationAllocation.findMany({
            where: { reservationId },
          });
        const sum = allocations.reduce(
          (sum, row) => sum.plus(row.quantity),
          new c.Prisma.Decimal(0),
        );
        assert.equal(sum.toString(), state.reserve.quantity);
        for (const balance of state.balances) {
          const { _sum } =
            await c.prisma.warehouseReservationAllocation.aggregate({
              where: {
                locationId: balance.storageLocationId,
                reservation: { itemId: balance.itemId },
              },
              _sum: { quantity: true },
            });
          assert.ok(balance.quantity.gte(_sum.quantity ?? 0));
        }
        assert.equal(
          state.transfers,
          Number(http.status === 201) + Number(operation === "ordinary"),
        );
      }
    },
  );
}

export async function verifyMoveApiReplays(t, fixture) {
  await t.test(
    "concurrent replays and competing moves preserve physical and reserved totals",
    async () => {
      const f = await fixture();
      const [a, b] = await Promise.all([f.move(), f.move()]);
      assert.deepEqual(a, b);
      assert.equal((await f.state()).transfers, 1);
      const competing = await Promise.all([
        f.move({ ...f.command, requestKey: randomUUID(), quantity: "4" }, null),
        f.move({ ...f.command, requestKey: randomUUID(), quantity: "4" }, null),
      ]);
      assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
      assert.equal((await f.state()).transfers, 2);
      assert.equal((await f.state()).reserve.quantity, "8");
    },
  );
}
