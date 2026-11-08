import assert from "node:assert/strict";
import { createReservationFixture } from "../warehouse-reservation-fixture.mjs";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "negative adjustments protect reservations including concurrent increases",
    async (c) => {
      const { prisma, admin, item, location, adjustments, request, quantity } =
        c;
      const { manager, first } = await createReservationFixture({
        ...c,
        actor: admin,
      });
      const reserve = (quantity) =>
        prisma.$transaction((tx) =>
          manager.reserve(
            { tx, actorUserId: admin.id },
            {
              itemId: String(item.id),
              locationId: String(location.id),
              orderId: first.id,
              quantity,
            },
          ),
        );
      const { reservation } = await reserve("12");
      assert.equal(
        (await adjustments.adjustStock(await request(), admin.id)).adjustment
          .quantityAfter,
        "16",
      );
      const blocked = await request({ quantity: "5" });
      await assert.rejects(
        adjustments.adjustStock(blocked, admin.id),
        code("WAREHOUSE_STOCK_RESERVED"),
      );
      assert.equal(await quantity(), "16");
      assert.equal(await prisma.warehouseStockAdjustment.count(), 1);

      const actual = await request({
        type: undefined,
        quantity: undefined,
        actualQuantity: "11",
        expectedQuantity: "16",
      });
      await assert.rejects(
        adjustments.adjustStock(actual, admin.id),
        code("WAREHOUSE_STOCK_RESERVED"),
      );
      const concurrent = await request({ quantity: "3" });
      const [writeOff, increase] = await Promise.allSettled([
        adjustments.adjustStock(concurrent, admin.id),
        reserve("3"),
      ]);
      assert.notEqual(writeOff.status, increase.status);
      const adjusted = writeOff.status === "fulfilled";
      code(
        adjusted
          ? "WAREHOUSE_RESERVATION_INSUFFICIENT"
          : "WAREHOUSE_STOCK_RESERVED",
      )((adjusted ? increase : writeOff).reason);
      assert.equal(await quantity(), adjusted ? "13" : "16");
      assert.equal(
        await prisma.warehouseStockAdjustment.count(),
        adjusted ? 2 : 1,
      );
      const current =
        await prisma.warehouseReservationAllocation.findFirstOrThrow({
          where: { reservationId: reservation.id, locationId: location.id },
        });
      assert.equal(String(current.quantity), adjusted ? "12" : "15");
    },
  );
}
