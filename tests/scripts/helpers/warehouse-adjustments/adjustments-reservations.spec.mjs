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
  await run(
    "row corrections preserve order demand and atomically reconcile selected coverage",
    async (c) => {
      const { prisma, admin, item, location, adjustments, request, quantity } =
        c;
      const { manager, first } = await createReservationFixture({
        ...c,
        actor: admin,
      });
      const { reservation } = await prisma.$transaction((tx) =>
        manager.reserve(
          { tx, actorUserId: admin.id },
          {
            itemId: String(item.id),
            locationId: String(location.id),
            orderId: first.id,
            quantity: "6",
          },
        ),
      );
      const before = await quantity();
      const payload = await request({
        type: undefined,
        quantity: undefined,
        expectedQuantity: before,
        actualQuantity: String(Number(before) - 1),
        portion: {
          reservationId: reservation.id,
          expectedQuantity: "6",
          actualQuantity: "5",
        },
      });
      await adjustments.adjustStock(payload, admin.id);
      assert.equal(await quantity(), String(Number(before) - 1));
      let r = await prisma.warehouseReservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { allocations: true },
      });
      assert.equal(r.quantity.toString(), "6");
      assert.equal(r.allocations[0].quantity.toString(), "5");
      await adjustments.adjustStock(payload, admin.id);
      assert.equal(await quantity(), String(Number(before) - 1));
      const restore = await request({
        type: undefined,
        quantity: undefined,
        expectedQuantity: await quantity(),
        actualQuantity: before,
        portion: {
          reservationId: reservation.id,
          expectedQuantity: "5",
          actualQuantity: "6",
        },
      });
      await adjustments.adjustStock(restore, admin.id);
      r = await prisma.warehouseReservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { allocations: true },
      });
      assert.equal(r.quantity.toString(), "6");
      assert.equal(r.allocations[0].quantity.toString(), "6");
      const tooMuch = await request({
        type: undefined,
        quantity: undefined,
        expectedQuantity: before,
        actualQuantity: String(Number(before) + 1),
        portion: {
          reservationId: reservation.id,
          expectedQuantity: "6",
          actualQuantity: "7",
        },
      });
      await assert.rejects(
        adjustments.adjustStock(tooMuch, admin.id),
        code("WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT"),
      );
      assert.equal(await quantity(), before);
      const free = String(Number(before) - 6);
      const freePayload = await request({
        type: undefined,
        quantity: undefined,
        expectedQuantity: before,
        actualQuantity: String(Number(before) - 1),
        portion: {
          expectedQuantity: free,
          actualQuantity: String(Number(free) - 1),
        },
      });
      await adjustments.adjustStock(freePayload, admin.id);
      r = await prisma.warehouseReservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: { allocations: true },
      });
      assert.equal(r.quantity.toString(), "6");
      assert.equal(r.allocations[0].quantity.toString(), "6");
    },
  );
  await run(
    "one count consumes free stock first and reduces multiple reserves atomically",
    async (c) => {
      const { prisma, admin, item, location, adjustments, request, quantity } =
        c;
      const { manager, first, second } = await createReservationFixture({
        ...c,
        actor: admin,
      });
      const [a, b] = await prisma.$transaction(async (tx) => {
        const context = { tx, actorUserId: admin.id };
        const reserve = (order, amount) =>
          manager.reserve(context, {
            itemId: String(item.id),
            locationId: String(location.id),
            orderId: order.id,
            quantity: amount,
          });
        return [
          (await reserve(first, "10")).reservation,
          (await reserve(second, "7")).reservation,
        ];
      });
      const before = await quantity();
      const payload = await request({
        type: undefined,
        quantity: undefined,
        expectedQuantity: before,
        actualQuantity: "14",
        shortageAllocations: [
          { reservationId: a.id, expectedQuantity: "10", quantity: "2" },
          { reservationId: b.id, expectedQuantity: "7", quantity: "2" },
        ],
      });
      const state = async () => {
        const rows = await prisma.warehouseReservation.findMany({
          where: { id: { in: [a.id, b.id] } },
          include: { allocations: true },
          orderBy: { quantity: "desc" },
        });
        return rows.map(({ quantity, allocations }) => [
          quantity.toString(),
          allocations[0].quantity.toString(),
        ]);
      };
      await assert.rejects(
        adjustments.adjustStock(
          {
            ...payload,
            shortageAllocations: [
              { ...payload.shortageAllocations[0], quantity: "2" },
            ],
          },
          admin.id,
        ),
        code("WAREHOUSE_ADJUSTMENT_STALE_PORTION"),
      );
      await assert.rejects(
        adjustments.adjustStock(
          {
            ...payload,
            shortageAllocations: [
              payload.shortageAllocations[0],
              { ...payload.shortageAllocations[1], expectedQuantity: "8" },
            ],
          },
          admin.id,
        ),
        code("WAREHOUSE_ADJUSTMENT_STALE_PORTION"),
      );
      assert.equal(await quantity(), before);
      assert.deepEqual(await state(), [
        ["10", "10"],
        ["7", "7"],
      ]);
      assert.equal(await prisma.warehouseStockAdjustment.count(), 0);

      const applied = await adjustments.adjustStock(payload, admin.id);
      const replay = await adjustments.adjustStock(
        {
          ...payload,
          shortageAllocations: [...payload.shortageAllocations].reverse(),
        },
        admin.id,
      );
      assert.deepEqual(replay, applied);
      assert.equal(await quantity(), "14");
      assert.deepEqual(await state(), [
        ["10", "8"],
        ["7", "5"],
      ]);
      assert.equal(await prisma.warehouseStockAdjustment.count(), 1);
    },
  );
}
