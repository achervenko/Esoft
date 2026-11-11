import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMixedBasics(
  c,
  t,
  { transfers, admin, keeper, request },
  fixture,
) {
  await t.test(
    "HTTP Transfers accepts an explicit mixed split and rejects missing reservation permission",
    async () => {
      const f = await fixture();
      const overview = await request(
        "GET",
        `/api/warehouse/stock-overview/items/${f.itemId}/warehouses/${c.a.warehouseId}`,
        200,
      );
      assert.equal(
        overview.locations.find((l) => l.location.id === c.loc(c.a))
          .reservations.length,
        2,
      );
      await request(
        "POST",
        "/api/warehouse/transfers",
        403,
        f.command,
        "keeper",
      );
      const result = await request(
        "POST",
        "/api/warehouse/transfers",
        201,
        f.command,
      );
      assert.equal(result.quantity, "8");
      const replay = await request(
        "POST",
        "/api/warehouse/transfers",
        201,
        f.command,
      );
      assert.equal(replay.id, result.id);
    },
  );
  await t.test(
    "mixed transfer moves free stock and explicitly selected orders atomically, preserving demand and coverage",
    async () => {
      const f = await fixture();
      const before = await f.state();
      const result = await transfers.create(f.command, admin.id);
      const after = await f.state();
      assert.deepEqual(
        after.balances.map((b) => b.quantity.toString()).sort(),
        ["4", "8"],
      );
      for (const r of after.reservations) {
        const previous = before.reservations.find((p) => p.id === r.id);
        assert.equal(r.quantity.toString(), previous.quantity.toString());
        assert.equal(
          r.allocations.reduce((n, a) => n + Number(a.quantity), 0),
          Number(r.quantity),
        );
      }
      assert.equal(after.transfers, 1);
      assert.equal(result.snapshot.distribution.freeQuantity, "3");
      assert.equal(
        (
          await transfers.create(
            {
              ...f.command,
              distribution: {
                ...f.command.distribution,
                reservations: [
                  ...f.command.distribution.reservations,
                ].reverse(),
              },
            },
            admin.id,
          )
        ).id,
        result.id,
      );
      assert.deepEqual(await f.state(), after);
      await assert.rejects(
        async () =>
          transfers.create(
            {
              ...f.command,
              distribution: {
                freeQuantity: "4",
                reservations: [
                  { reservationId: f.reservations[0].id, quantity: "4" },
                ],
              },
            },
            admin.id,
          ),
        (e) => e.response?.code === "WAREHOUSE_TRANSFER_REQUEST_CONFLICT",
      );
    },
  );
  await t.test(
    "a fully reserved transfer preserves another order and a fully free transfer keeps existing allocations",
    async () => {
      const f = await fixture();
      await transfers.create(
        {
          ...f.command,
          quantity: "4",
          distribution: {
            freeQuantity: "0",
            reservations: [
              { reservationId: f.reservations[0].id, quantity: "4" },
            ],
          },
        },
        admin.id,
      );
      const other = await c.prisma.warehouseReservationAllocation.findMany({
        where: { reservationId: f.reservations[1].id },
      });
      assert.equal(other.length, 1);
      assert.equal(other[0].locationId, c.a.id);
      assert.equal(other[0].quantity.toString(), "3");
      await transfers.create(
        {
          ...f.command,
          requestKey: randomUUID(),
          quantity: "2",
          distribution: { freeQuantity: "2", reservations: [] },
        },
        keeper.id,
      );
      assert.equal((await f.state()).transfers, 2);
    },
  );
}
