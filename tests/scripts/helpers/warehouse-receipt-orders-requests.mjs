import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyReceiptOrderRequests(c, t, context) {
  const { make, request, keeper } = context;
  await t.test(
    "requires explicit deficit allocation and rejects invalid order and distribution data",
    async () => {
      const f = await make();
      await f.seed();
      const receipt = await f.create();
      const before = await f.state();
      const missing = await f.place(
        receipt,
        "5",
        undefined,
        c.a,
        randomUUID(),
        409,
      );
      assert.equal(
        missing.code,
        "WAREHOUSE_RECEIPT_RESERVATION_ALLOCATION_REQUIRED",
      );
      assert.equal(missing.details.deficitQuantity, "4");
      for (const [allocation, status] of [
        [{ restoreQuantity: "5", increaseQuantity: "0" }, 409],
        [{ restoreQuantity: "1", increaseQuantity: "3" }, 400],
        [{ restoreQuantity: "-1", increaseQuantity: "6" }, 400],
        [{ restoreQuantity: "0.0001", increaseQuantity: "4.9999" }, 400],
        [{ restoreQuantity: 1, increaseQuantity: "4" }, 400],
        [{ restoreQuantity: "1", increaseQuantity: "4", extra: true }, 400],
      ])
        await f.place(receipt, "5", allocation, c.a, randomUUID(), status);
      assert.deepEqual(await f.state(), before);
      const ordinary = await f.create("1", null);
      await f.place(
        ordinary,
        "1",
        { restoreQuantity: "0", increaseQuantity: "1" },
        c.a,
        randomUUID(),
        400,
      );
      for (const [orderId, status] of [
        ["bad", 400],
        [randomUUID(), 404],
      ]) {
        await request(
          "POST",
          "/api/warehouse/receipts",
          status,
          {
            warehouseId: String(c.a.warehouseId),
            requestKey: randomUUID(),
            lines: [{ itemId: f.itemId, quantity: "1", orderId }],
          },
          "keeper",
        );
      }
    },
  );

  await t.test(
    "manual receipt and placement keys protect order and allocation, including concurrent retries",
    async () => {
      const f = await make();
      const key = randomUUID();
      const body = {
        warehouseId: String(c.a.warehouseId),
        requestKey: key,
        lines: [{ itemId: f.itemId, quantity: "5", orderId: f.order.id }],
      };
      const receipt = await request(
        "POST",
        "/api/warehouse/receipts",
        201,
        body,
        "keeper",
      );
      const other = await context.createOrder(randomUUID());
      await request(
        "POST",
        "/api/warehouse/receipts",
        409,
        { ...body, lines: [{ ...body.lines[0], orderId: other.id }] },
        "keeper",
      );
      const placementKey = randomUUID();
      const [a, b] = await Promise.all([
        f.place(receipt, "5", undefined, c.a, placementKey),
        f.place(receipt, "5", undefined, c.a, placementKey),
      ]);
      assert.deepEqual(a, b);
      const committed = await f.state();
      await c.prisma.customerOrder.update({
        where: { id: f.order.id },
        data: { number: "Changed", status: "Закрыт" },
      });
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(f.itemId) },
        data: { name: "Renamed" },
      });
      assert.deepEqual(
        await f.place(receipt, "5", undefined, c.a, placementKey),
        a,
      );
      assert.deepEqual(await f.state(), committed);
      await f.place(
        receipt,
        "5",
        { restoreQuantity: "0", increaseQuantity: "5" },
        c.a,
        placementKey,
        409,
      );
      await f.place(receipt, "4", undefined, c.a, placementKey, 409);
      await f.place(receipt, "5", undefined, c.b, placementKey, 409);
      assert.equal(committed.placements, 1);
    },
  );

  await t.test(
    "receipt permissions allow bounded reservation without manual reservation rights",
    async () => {
      const f = await make();
      const receipt = await f.create("1");
      await f.place(
        receipt,
        "1",
        undefined,
        c.a,
        randomUUID(),
        403,
        "operator",
      );
      await c.prisma.user.update({
        where: { id: keeper.id },
        data: { banned: true },
      });
      await f.place(receipt, "1", undefined, c.a, randomUUID(), 403);
      await c.prisma.user.update({
        where: { id: keeper.id },
        data: { banned: false },
      });
      await f.place(receipt, "1");
      await request(
        "POST",
        "",
        403,
        {
          orderId: f.order.id,
          itemId: f.itemId,
          locationId: c.loc(c.a),
          quantity: "1",
        },
        "keeper",
      );
      const { id } = await f.state();
      await request(
        "POST",
        "/" + id + "/coverage/restore",
        403,
        { locationId: c.loc(c.a), quantity: "1", comment: "Forbidden" },
        "keeper",
      );
    },
  );
}
