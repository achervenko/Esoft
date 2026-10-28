import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  WarehouseStockOverviewService,
} = require("../../../backend/dist/src/warehouse/stock/stock-overview.service.js");
export async function verifyStockOverview(
  { prisma, stock, actor, namespace },
  t,
) {
  const overview = new WarehouseStockOverviewService(prisma);
  const warehouse = await prisma.warehouse.create({
    data: { name: namespace + " overview" },
  });
  const other = await prisma.warehouse.create({
    data: { name: namespace + " other" },
  });
  const item = await prisma.warehouseItem.create({
    data: {
      article: namespace + "-6204%_\\",
      name: "Подшипник 6204 ZZ",
      unit: "шт",
    },
  });
  const zero = await prisma.warehouseItem.create({
    data: { article: namespace + "-zero", name: "Нулевой", unit: "м" },
  });
  const missing = await prisma.warehouseItem.create({
    data: { article: namespace + "-absent", name: "Без баланса", unit: "м" },
  });
  const places = [];
  for (const [i, qty] of ["10.001", "5.002", "2.003", "1.004", "0"].entries()) {
    const location = await prisma.warehouseStorageLocation.create({
      data: { warehouseId: warehouse.id, name: "Место " + i },
    });
    const balance = await prisma.warehouseBalance.create({
      data: { itemId: item.id, storageLocationId: location.id, quantity: qty },
    });
    places.push({ location, balance });
  }
  const foreign = await prisma.warehouseStorageLocation.create({
    data: { warehouseId: other.id, name: "Другое место" },
  });
  await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: foreign.id, quantity: "15" },
  });
  await prisma.warehouseBalance.create({
    data: {
      itemId: zero.id,
      storageLocationId: places[0].location.id,
      quantity: "0",
    },
  });
  const wid = String(warehouse.id),
    oid = String(other.id),
    iid = String(item.id);
  await t.test(
    "aggregates across places, separates warehouses, paginates groups and bounds previews",
    async () => {
      const result = await overview.list({ search: namespace });
      assert.equal(result.total, 2);
      assert.deepEqual(
        result.items.map((r) => r.warehouse.id).sort(),
        [wid, oid].sort(),
      );
      const own = result.items.find((r) => r.warehouse.id === wid);
      assert.equal(own.quantity, "18.01");
      assert.equal(own.locationsCount, 4);
      assert.equal(own.locationsPreview.length, 3);
      assert.equal(own.item.photo, null);
      const p = await overview.list({
        search: namespace,
        limit: "1",
        page: "2",
      });
      assert.equal(p.total, 2);
      assert.equal(p.items.length, 1);
      assert.notEqual(
        p.items[0].id,
        (await overview.list({ search: namespace, limit: "1" })).items[0].id,
      );
    },
  );
  await t.test(
    "search is partial, case insensitive and literal; filters select groups without truncating totals",
    async () => {
      assert.equal(
        (await overview.list({ warehouseId: wid, search: "ПОДШИП" })).total,
        1,
      );
      assert.equal(
        (await overview.list({ warehouseId: wid, search: "%_\\" })).total,
        1,
      );
      assert.equal(
        (
          await overview.list({
            warehouseId: wid,
            locationId: String(places[0].location.id),
          })
        ).items[0].quantity,
        "18.01",
      );
      assert.equal(
        (
          await overview.list({
            warehouseId: wid,
            locationId: String(foreign.id),
          })
        ).total,
        0,
      );
      assert.equal(
        (
          await overview.list({
            warehouseId: wid,
            locationId: String(places[4].location.id),
          })
        ).total,
        0,
      );
      const rows = await overview.list({
        warehouseId: wid,
        quantityState: "ALL",
      });
      assert.equal(rows.total, 2);
      assert.ok(rows.items.every((r) => r.item.id !== String(missing.id)));
      const zeros = await overview.list({
        warehouseId: wid,
        quantityState: "ZERO",
      });
      assert.equal(zeros.total, 1);
      assert.equal(zeros.items[0].item.id, String(zero.id));
      assert.equal(zeros.items[0].locationsCount, 0);
      assert.equal(
        (
          await overview.list({
            warehouseId: wid,
            sortBy: "quantity",
            sortOrder: "desc",
            quantityState: "ALL",
          })
        ).items[0].item.id,
        iid,
      );
      for (const sortBy of ["article", "name", "warehouse"])
        assert.equal(
          (await overview.list({ warehouseId: wid, sortBy, sortOrder: "desc" }))
            .total,
          1,
        );
      assert.equal(
        (await overview.list({ search: "absent impossible" })).items.length,
        0,
      );
    },
  );
  await t.test(
    "distribution totals, free quantity and references survive inactive entries; movement refreshes groups",
    async () => {
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace + "-overview" },
      });
      await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: places[0].balance.id,
          projectId: project.id,
          quantity: "12",
        },
      });
      const detail = await overview.distribution(iid, wid);
      assert.equal(detail.totalQuantity, "18.01");
      assert.equal(detail.locations.length, 5);
      assert.equal(detail.locations[0].reserved, "12");
      assert.equal(detail.locations[0].available, "0");
      await prisma.warehouseStorageLocation.update({
        where: { id: places[0].location.id },
        data: { isActive: false },
      });
      assert.equal(
        (await overview.list({ warehouseId: wid })).items[0].quantity,
        "18.01",
      );
      await assert.rejects(
        overview.distribution("9223372036854775807", wid),
        (e) => e.status === 404,
      );
      assert.throws(
        () => overview.distribution(iid, "0"),
        (e) => e.status === 400,
      );
      const before = (await overview.distribution(iid, oid)).totalQuantity;
      await prisma.$transaction((tx) =>
        stock.moveStock(
          { tx, actorUserId: actor.id },
          iid,
          String(places[1].location.id),
          String(foreign.id),
          "1",
        ),
      );
      assert.equal(
        (await overview.distribution(iid, wid)).totalQuantity,
        "17.01",
      );
      assert.equal(
        (await overview.distribution(iid, oid)).totalQuantity,
        String(Number(before) + 1),
      );
    },
  );
}
