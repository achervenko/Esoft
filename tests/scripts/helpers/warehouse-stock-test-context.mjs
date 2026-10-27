import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const hasCode = (code, status) => (error) => {
  assert.equal(error.response?.code, code);
  if (status) assert.equal(error.getStatus(), status);
  return true;
};
let fixtureNumber = 0;
export async function createStockTestContext(prisma, database) {
  const { Prisma } = require("@prisma/client");
  const {
    WarehouseStockService,
  } = require("../../../backend/dist/src/warehouse/stock/stock.service.js");
  const {
    WarehouseStockQueryService,
  } = require("../../../backend/dist/src/warehouse/stock/stock-query.service.js");
  const {
    WarehouseCatalogService,
  } = require("../../../backend/dist/src/warehouse/catalog/catalog.service.js");
  const {
    AuditLogService,
  } = require("../../../backend/dist/src/audit/audit-log.service.js");

  const namespace = "stock-" + randomUUID();
  const largeId = 9007199254740993n + BigInt(fixtureNumber++) * 100n;
  const actor = await prisma.user.create({
    data: {
      id: `${namespace}-actor`,
      name: "Storekeeper",
      email: `${namespace}@test.invalid`,
      role: "storekeeper",
    },
  });
  const audit = new AuditLogService(prisma);
  const stock = new WarehouseStockService(
    new WarehouseStockQueryService(prisma),
    audit,
  );
  const catalog = new WarehouseCatalogService(prisma, audit);
  const item = await prisma.warehouseItem.create({
    data: {
      id: largeId,
      article: `${namespace}-STOCK-A`,
      name: "Item A",
      unit: "шт",
    },
  });
  const a = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { code: namespace },
          create: { code: namespace, name: "Test warehouse" },
        },
      },
      id: largeId,
      code: "A",
      name: "Shelf A",
    },
  });
  const b = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { code: namespace },
          create: { code: namespace, name: "Test warehouse" },
        },
      },
      code: "B",
      name: "Shelf B",
    },
  });
  const c = await prisma.warehouseStorageLocation.create({
    data: {
      warehouse: {
        connectOrCreate: {
          where: { code: namespace },
          create: { code: namespace, name: "Test warehouse" },
        },
      },
      code: "C",
      name: "Shelf C",
    },
  });
  const id = item.id.toString();
  const loc = (row) => row.id.toString();
  const transaction = (operation) =>
    prisma.$transaction((tx) => operation({ tx, actorUserId: actor.id }), {
      timeout: 20000,
      maxWait: 20000,
    });
  const receive = (location, quantity, itemId = id) =>
    transaction((ctx) =>
      stock.receiveStock(ctx, itemId, loc(location), quantity),
    );
  const issue = (location, quantity, itemId = id) =>
    transaction((ctx) =>
      stock.issueStock(ctx, itemId, loc(location), quantity),
    );
  const move = (from, to, quantity, itemId = id) =>
    transaction((ctx) =>
      stock.moveStock(ctx, itemId, loc(from), loc(to), quantity),
    );
  const read = (location, itemId = id) =>
    stock.getBalance(itemId, loc(location));
  const newItem = (article) =>
    prisma.warehouseItem
      .create({
        data: { article: `${namespace}-${article}`, name: article, unit: "шт" },
      })
      .then((row) => row.id.toString());

  return {
    prisma,
    database,
    namespace,
    Prisma,
    WarehouseStockService,
    WarehouseStockQueryService,
    actor,
    audit,
    stock,
    catalog,
    item,
    a,
    b,
    c,
    id,
    loc,
    transaction,
    receive,
    issue,
    move,
    read,
    newItem,
  };
}
