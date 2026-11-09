import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyReceiptOrderBasics(
  c,
  t,
  { make, request, createOrder },
) {
  await t.test(
    "each line keeps its own order, including catalog drafts and fractional placements",
    async () => {
      const f = await make();
      const other = await createOrder(randomUUID());
      const draftId = randomUUID();
      const body = {
        requestKey: randomUUID(),
        warehouseId: String(c.a.warehouseId),
        newItems: [
          {
            draftId,
            item: { article: randomUUID(), name: "Receipt draft", unit: "шт" },
          },
        ],
        lines: [
          { itemId: f.itemId, quantity: "0.125", orderId: f.order.id },
          { itemId: f.itemId, quantity: "0.25", orderId: other.id },
          { itemId: f.itemId, quantity: "1.5" },
          { draftId, quantity: "2.75", orderId: f.order.id },
        ],
      };
      const receipt = await request(
        "POST",
        "/api/warehouse/receipts",
        201,
        body,
        "keeper",
      );
      assert.deepEqual(
        await request(
          "POST",
          "/api/warehouse/receipts",
          201,
          {
            ...body,
            lines: [...body.lines].reverse(),
          },
          "keeper",
        ),
        receipt,
      );
      for (const line of receipt.lines) {
        const result = await f.place(
          { ...receipt, lines: [line] },
          line.quantity,
        );
        assert.equal(result.reservation?.orderId, line.orderId);
      }
      await f.assertAmounts("0.125", "0.125", "0");
      assert.equal((await c.read(c.a, f.itemId)).freeQuantity, "1.5");
      const draft = receipt.lines.find((line) => line.itemId !== f.itemId);
      assert.equal((await c.read(c.a, draft.itemId)).reservedQuantity, "2.75");
      assert.equal(
        await c.prisma.warehouseReservation.count({
          where: { itemId: { in: [BigInt(f.itemId), BigInt(draft.itemId)] } },
        }),
        3,
      );
    },
  );
  await t.test(
    "ordinary receipts remain stock neutral until placement and never restore an unrelated deficit",
    async () => {
      const f = await make();
      await f.seed();
      const ordinary = await f.create("5", null);
      assert.equal(ordinary.lines[0].orderId, undefined);
      const result = await f.place(ordinary);
      assert.equal(result.reservation, undefined);
      await f.assertAmounts("10", "6", "4");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "15");
    },
  );

  await t.test(
    "manual lines reserve their actual placements, preserve UUID and return closed-order warnings",
    async () => {
      const f = await make();
      await c.prisma.customerOrder.update({
        where: { id: f.order.id },
        data: { status: "Закрыт" },
      });
      const receipt = await f.create("7");
      assert.equal(receipt.lines[0].orderId, f.order.id);
      assert.equal(receipt.lines[0].order.warnings[0].code, "ORDER_CLOSED");
      assert.equal((await f.state()).balances.length, 0);
      const first = await f.place(receipt, "3");
      assert.equal(first.reservation.orderId, f.order.id);
      assert.equal(first.reservation.warnings[0].code, "ORDER_CLOSED");
      const next = await f.place(receipt, "4", undefined, c.b);
      assert.equal(
        next.reservation.reservationId,
        first.reservation.reservationId,
      );
      await f.assertAmounts("7", "7", "0");
      assert.equal((await c.read(c.a, f.itemId)).reservedQuantity, "3");
      assert.equal((await c.read(c.b, f.itemId)).reservedQuantity, "4");
      const extra = await f.create("2");
      assert.equal(
        (await f.place(extra, "2")).reservation.reservationId,
        first.reservation.reservationId,
      );
      const other = await c.prisma.warehouseStorageLocation.create({
        data: {
          name: randomUUID(),
          warehouse: { create: { name: randomUUID() } },
        },
      });
      await f.place(
        await f.create("2", f.order.id, other.warehouseId),
        "2",
        undefined,
        other,
      );
      await f.assertAmounts("11", "11", "0");
      assert.equal((await c.read(other, f.itemId)).freeQuantity, "0");
    },
  );

  await t.test(
    "explicit restoration, increase and mixed allocation preserve the chosen economic meaning",
    async () => {
      for (const [
        restoreQuantity,
        increaseQuantity,
        total,
        covered,
        deficit,
      ] of [
        ["4", "0", "10", "10", "0"],
        ["2", "0", "10", "8", "2"],
        ["0", "5", "15", "11", "4"],
        ["3", "3", "13", "12", "1"],
      ]) {
        const f = await make();
        const id = await f.seed();
        const amount = new c.Prisma.Decimal(restoreQuantity)
          .plus(increaseQuantity)
          .toString();
        const receipt = await f.create(amount);
        const beforeFree = (await c.read(c.a, f.itemId)).freeQuantity;
        const result = await f.place(receipt, amount, {
          restoreQuantity,
          increaseQuantity,
        });
        assert.equal(result.reservation.reservationId, id);
        assert.equal(result.reservation.restoredQuantity, restoreQuantity);
        assert.equal(result.reservation.increasedQuantity, increaseQuantity);
        assert.equal(result.reservation.deficitQuantity, deficit);
        await f.assertAmounts(total, covered, deficit);
        assert.equal((await c.read(c.a, f.itemId)).freeQuantity, beforeFree);
        const logs = await c.prisma.auditLog.findMany({
          where: { entityType: "warehouse_reservation", entityStringId: id },
          orderBy: { id: "desc" },
        });
        assert.equal(
          JSON.parse(logs[0].newValue).receipt.receiptId,
          receipt.id,
        );
        assert.equal(
          JSON.parse(logs[0].newValue).receipt.receiptLineId,
          receipt.lines[0].id,
        );
      }
    },
  );
}
