import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMixedValidation(
  t,
  { transfers, admin, keeper },
  fixture,
) {
  await t.test(
    "mixed transfer rejects invalid distributions, unavailable stock, foreign items and missing reservation permission",
    async () => {
      const f = await fixture();
      const before = await f.state();
      await assert.rejects(
        async () => transfers.create(f.command, keeper.id),
        (e) => e.getStatus() === 403,
      );
      for (const distribution of [
        {
          freeQuantity: "6",
          reservations: [
            { reservationId: f.reservations[0].id, quantity: "2" },
          ],
        },
        {
          freeQuantity: "0",
          reservations: [
            { reservationId: f.reservations[0].id, quantity: "8" },
          ],
        },
        {
          freeQuantity: "3",
          reservations: [{ reservationId: randomUUID(), quantity: "5" }],
        },
      ])
        await assert.rejects(async () =>
          transfers.create({ ...f.command, distribution }, admin.id),
        );
      for (const distribution of [
        { freeQuantity: "1", reservations: [] },
        {
          freeQuantity: "0",
          reservations: [
            { reservationId: f.reservations[0].id, quantity: "4" },
            { reservationId: f.reservations[0].id, quantity: "4" },
          ],
        },
        { freeQuantity: "8.0001", reservations: [] },
      ])
        await assert.rejects(
          async () =>
            transfers.create({ ...f.command, distribution }, admin.id),
          (e) => e.getStatus() === 400,
        );
      const other = await fixture();
      await assert.rejects(async () =>
        transfers.create(
          {
            ...f.command,
            distribution: {
              freeQuantity: "4",
              reservations: [
                { reservationId: other.reservations[0].id, quantity: "4" },
              ],
            },
          },
          admin.id,
        ),
      );
      assert.deepEqual(await f.state(), before);
    },
  );
}
