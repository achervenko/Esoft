import assert from "node:assert/strict";
import { load } from "./adjustments-test-context.mjs";
import { setup, input } from "./reservation-operations.test-context.mjs";
export async function verify(run) {
  await run(
    "borrowed stock protects other projects and reports shortage and movable quantity",
    async (c) => {
      const service = setup(c),
        id = String(c.reservation.id),
        borrowed = input(c, "BORROW", "5");
      const other = await c.prisma.warehouseProject.create({
        data: { projectNumber: "OTHER" },
      });
      await c.prisma.warehouseProjectReservation.create({
        data: {
          balanceId: c.reservation.balanceId,
          projectId: other.id,
          quantity: "2",
        },
      });
      await assert.rejects(service.execute(id, borrowed, c.keeper.id));
      const first = await service.execute(id, borrowed, c.admin.id);
      assert.equal(await c.quantity(), "15");
      assert.equal(first.after, "18");
      assert.equal(first.borrowedAfter, "5");
      const { WarehouseStockOverviewService } = load(
        "warehouse/stock/stock-overview.service.js",
      );
      const overview = new WarehouseStockOverviewService(c.prisma);
      const data = await overview.distribution(
        String(c.item.id),
        String(c.location.warehouseId),
      );
      assert.equal(data.locations[0].shortage, "5");
      assert.equal(data.locations[0].available, "0");
      assert.equal(
        data.locations[0].reservations.find((r) => r.id === id).movableQuantity,
        "13",
      );
      const { planReservationTransfer } = load(
        "warehouse/transfers/transfers-reservations.js",
      );
      const { planReservationConsumption } = load(
        "warehouse/reservations/reservation-consumption.js",
      );
      const { createRequire } = await import("node:module");
      const { Prisma } = createRequire(import.meta.url)("@prisma/client");
      const rows = await c.prisma.warehouseProjectReservation.findMany({
        where: { balanceId: c.reservation.balanceId },
        include: { project: true },
      });
      assert.throws(() =>
        planReservationTransfer(
          rows,
          c.reservation.balanceId,
          undefined,
          "15",
          "1",
          null,
        ),
      );
      const planned = planReservationTransfer(
        rows,
        c.reservation.balanceId,
        undefined,
        "15",
        "13",
        String(c.reservation.projectId),
      );
      assert.equal(planned.sourceAfter.toString(), "5");
      const used = planReservationConsumption(
        new Prisma.Decimal(15),
        rows,
        c.reservation.projectId,
        new Prisma.Decimal(13),
        false,
      );
      assert.equal(used[0].after, "5");
    },
  );
  await run(
    "fully borrowed reserve remains visible with zero physical stock",
    async (c) => {
      await c.prisma.warehouseProjectReservation.update({
        where: { id: c.reservation.id },
        data: { quantity: "20" },
      });
      await setup(c).execute(
        String(c.reservation.id),
        input(c, "BORROW", "20", "20"),
        c.admin.id,
      );
      const { WarehouseStockOverviewService } = load(
        "warehouse/stock/stock-overview.service.js",
      );
      const overview = new WarehouseStockOverviewService(c.prisma);
      const list = await overview.list({ quantityState: "POSITIVE" });
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0].quantity, "0");
      assert.equal(list.items[0].locationsCount, 1);
      const data = await overview.distribution(
        String(c.item.id),
        String(c.location.warehouseId),
      );
      assert.equal(data.locations[0].reservations[0].movableQuantity, "0");
      assert.equal(data.locations[0].shortage, "20");
    },
  );
}
