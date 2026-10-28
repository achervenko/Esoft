import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  WarehouseStorageLocationsService,
} = require("../../../backend/dist/src/warehouse/storage-structure/storage-locations.service.js");
const {
  AuditLogService,
} = require("../../../backend/dist/src/audit/audit-log.service.js");
const code = (expected) => (e) => {
  assert.equal(e.response?.code, expected);
  return true;
};
export async function verifyStorageLocations(prisma) {
  const service = new WarehouseStorageLocationsService(
    prisma,
    new AuditLogService(prisma),
  );
  const user = await prisma.user.create({
    data: {
      id: "locations-keeper",
      name: "Keeper",
      email: "locations@test.invalid",
      role: "storekeeper",
    },
  });
  const parent = await prisma.warehouse.create({
    data: { name: "Locations warehouse" },
  });
  const warehouseId = String(parent.id);
  const denied = await prisma.user.create({
    data: {
      id: "locations-denied",
      name: "Denied",
      email: "locations-denied@test.invalid",
      role: "operator",
    },
  });
  await assert.rejects(
    service.create({ warehouseId, name: "No" }, denied.id),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.create({ warehouseId, name: "No" }, "missing"),
    (e) => e.status === 403,
  );
  const loc = await service.create({ warehouseId, name: " Полка " }, user.id);
  assert.equal(loc.name, "Полка");
  assert.equal(typeof loc.id, "string");
  assert.equal(loc.isActive, true);
  await assert.rejects(
    service.create({ warehouseId, name: loc.name }, user.id),
    (error) => {
      assert.equal(error.getStatus(), 409);
      return code("WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT")(error);
    },
  );
  const auditWhere = {
    entityType: "warehouse_storage_location",
    entityStringId: loc.id,
  };
  const auditCount = await prisma.auditLog.count({ where: auditWhere });
  assert.deepEqual(
    await service.update(loc.id, { name: loc.name }, user.id),
    loc,
  );
  assert.equal(await prisma.auditLog.count({ where: auditWhere }), auditCount);
  const concurrent = await Promise.allSettled([
    service.create({ warehouseId, name: "RACE" }, user.id),
    service.create({ warehouseId, name: "RACE" }, user.id),
  ]);
  assert.equal(concurrent.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((x) => x.status === "rejected").reason.getStatus(),
    409,
  );
  assert.equal(
    concurrent.find((x) => x.status === "rejected").reason.response?.code,
    "WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT",
    JSON.stringify(concurrent.find((x) => x.status === "rejected").reason),
  );
  await assert.rejects(
    service.update(loc.id, { name: "RACE" }, user.id),
    code("WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT"),
  );
  await Promise.all([
    service.update(loc.id, { name: "Обновлено" }, user.id),
    service.update(loc.id, { isActive: false }, user.id),
  ]);
  assert.deepEqual(await service.findOne(loc.id), {
    ...loc,
    name: "Обновлено",

    isActive: false,
    hasStock: false,
  });
  const item = await prisma.warehouseItem.create({
    data: { article: "TEST", name: "Test", unit: "шт" },
  });
  await prisma.warehouseBalance.create({
    data: { itemId: item.id, storageLocationId: BigInt(loc.id), quantity: "5" },
  });
  await service.update(loc.id, { isActive: false }, user.id);
  assert.equal((await service.findOne(loc.id)).isActive, false);
  assert.equal((await service.findOne(loc.id)).hasStock, true);
  assert.equal((await service.list({ isActive: "false" })).total, 1);
  assert.equal((await service.list({ search: "обНОв" })).items[0].id, loc.id);
  assert.equal((await service.list({ search: "%" })).total, 0);
  assert.equal((await service.list({})).total, 2);
  const failing = new WarehouseStorageLocationsService(prisma, {
    writeFieldChanges: async () => {
      throw new Error("audit unavailable");
    },
  });
  await assert.rejects(
    failing.update(loc.id, { name: "Rollback" }, user.id),
    /audit unavailable/,
  );
  assert.equal((await service.findOne(loc.id)).name, "Обновлено");
  await assert.rejects(
    failing.create({ warehouseId, name: "Rollback" }, user.id),
    /audit unavailable/,
  );
  assert.equal(
    await prisma.warehouseStorageLocation.count({
      where: { warehouseId: parent.id, name: "Rollback" },
    }),
    0,
  );
  await prisma.user.update({ where: { id: user.id }, data: { banned: true } });
  await assert.rejects(
    service.update(loc.id, { name: "Denied" }, user.id),
    (e) => e.status === 403,
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { banned: false, role: "operator" },
  });
  await assert.rejects(
    service.update(loc.id, { name: "Denied" }, user.id),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.findOne("9223372036854775807"),
    code("WAREHOUSE_STORAGE_LOCATION_NOT_FOUND"),
  );
  const audit = await prisma.auditLog.findMany({
    where: { entityType: "warehouse_storage_location", entityStringId: loc.id },
  });
  assert.ok(audit.length >= 4);
}
