import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  WarehousesService,
} = require("../../../backend/dist/src/warehouse/storage-structure/warehouses.service.js");
const {
  WarehouseStorageLocationsService,
} = require("../../../backend/dist/src/warehouse/storage-structure/storage-locations.service.js");
const {
  AuditLogService,
} = require("../../../backend/dist/src/audit/audit-log.service.js");
const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};
export async function verifyStorageStructure(prisma) {
  const audit = new AuditLogService(prisma);
  const warehouses = new WarehousesService(prisma, audit);
  const locations = new WarehouseStorageLocationsService(prisma, audit);
  const actor = await prisma.user.create({
    data: {
      id: "structure-keeper",
      name: "Keeper",
      email: "structure@test.invalid",
      role: "storekeeper",
    },
  });
  const a = await warehouses.create(
    { code: " PROJECTS ", name: " Проектный склад " },
    actor.id,
  );
  const b = await warehouses.create(
    { code: "ELECTRIC", name: "Электрики" },
    actor.id,
  );
  assert.equal(a.code, "PROJECTS");
  assert.equal(typeof a.id, "string");
  assert.equal(a.isActive, true);
  await assert.rejects(
    warehouses.create({ code: a.code, name: "Duplicate" }, actor.id),
    code("WAREHOUSE_CODE_CONFLICT"),
  );
  await assert.rejects(
    warehouses.update(b.id, { code: a.code }, actor.id),
    code("WAREHOUSE_CODE_CONFLICT"),
  );
  assert.equal(
    (await warehouses.list({ search: "роект", isActive: "true" })).items[0].id,
    a.id,
  );
  assert.equal((await warehouses.list({ search: "%" })).total, 0);
  const count = await prisma.auditLog.count({
    where: { entityType: "warehouse", entityStringId: a.id },
  });
  await warehouses.update(a.id, { name: a.name }, actor.id);
  assert.equal(
    await prisma.auditLog.count({
      where: { entityType: "warehouse", entityStringId: a.id },
    }),
    count,
  );
  const x = await locations.create(
    { warehouseId: a.id, code: "A-01", name: "Угол ангара" },
    actor.id,
  );
  const y = await locations.create(
    { warehouseId: b.id, code: "A-01", name: "Палетоместо" },
    actor.id,
  );
  assert.equal(x.warehouseId, a.id);
  assert.deepEqual(x.warehouse, a);
  assert.notEqual(x.id, y.id);
  assert.deepEqual(
    (await locations.list({ warehouseId: b.id })).items.map((r) => r.id),
    [y.id],
  );
  await assert.rejects(
    locations.create(
      { warehouseId: a.id, code: "A-01", name: "Duplicate" },
      actor.id,
    ),
    code("WAREHOUSE_STORAGE_LOCATION_CODE_CONFLICT"),
  );
  await assert.rejects(
    locations.create({ code: "MISSING", name: "Missing warehouse" }, actor.id),
    code("INVALID_WAREHOUSE_ID"),
  );
  await assert.rejects(
    locations.create(
      {
        warehouseId: "9223372036854775807",
        code: "MISSING",
        name: "Missing warehouse",
      },
      actor.id,
    ),
    code("WAREHOUSE_NOT_FOUND"),
  );
  await assert.rejects(
    locations.update(x.id, { warehouseId: b.id }, actor.id),
    code("UNKNOWN_FIELDS"),
  );
  await assert.rejects(
    prisma.warehouse.delete({ where: { id: BigInt(a.id) } }),
    { code: "P2003" },
  );
  await assert.rejects(
    warehouses.update(a.id, { isActive: false }, actor.id),
    code("WAREHOUSE_HAS_ACTIVE_LOCATIONS"),
  );
  await locations.update(x.id, { isActive: false }, actor.id);
  await warehouses.update(a.id, { isActive: false }, actor.id);
  await assert.rejects(
    locations.update(x.id, { isActive: true }, actor.id),
    code("WAREHOUSE_INACTIVE"),
  );
  await assert.rejects(
    locations.create({ warehouseId: a.id, code: "NEW", name: "New" }, actor.id),
    code("WAREHOUSE_INACTIVE"),
  );
  await locations.update(x.id, { name: "Историческое место" }, actor.id);
  await warehouses.update(a.id, { isActive: true }, actor.id);
  await locations.update(x.id, { isActive: true }, actor.id);
  const failAudit = {
    writeFieldChanges: async () => {
      throw new Error("audit unavailable");
    },
  };
  const failing = new WarehousesService(prisma, failAudit);
  await assert.rejects(
    failing.create({ code: "ROLLBACK-WAREHOUSE", name: "Rollback" }, actor.id),
    /audit unavailable/,
  );
  assert.equal(
    await prisma.warehouse.count({ where: { code: "ROLLBACK-WAREHOUSE" } }),
    0,
  );
  await assert.rejects(
    failing.update(a.id, { name: "Wrong" }, actor.id),
    /audit unavailable/,
  );
  assert.equal((await warehouses.findOne(a.id)).name, a.name);
  const concurrent = await Promise.allSettled([
    warehouses.create({ code: "RACE-WAREHOUSE", name: "One" }, actor.id),
    warehouses.create({ code: "RACE-WAREHOUSE", name: "Two" }, actor.id),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((r) => r.status === "rejected").reason.response.code,
    "WAREHOUSE_CODE_CONFLICT",
  );
  for (const action of ["create", "activate"]) {
    const parent = await warehouses.create(
      { code: "RACE-" + action, name: "Race" },
      actor.id,
    );
    const inactive = await locations.create(
      {
        warehouseId: parent.id,
        code: "INACTIVE",
        name: "Inactive",
        isActive: false,
      },
      actor.id,
    );
    const results = await Promise.allSettled([
      warehouses.update(parent.id, { isActive: false }, actor.id),
      action === "create"
        ? locations.create(
            { warehouseId: parent.id, code: "NEW", name: "New" },
            actor.id,
          )
        : locations.update(inactive.id, { isActive: true }, actor.id),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const current = await warehouses.findOne(parent.id);
    const active = await locations.list({
      warehouseId: parent.id,
      isActive: "true",
    });
    assert.ok(current.isActive || active.total === 0);
  }
  await prisma.user.update({ where: { id: actor.id }, data: { banned: true } });
  await assert.rejects(
    warehouses.update(a.id, { name: "Denied" }, actor.id),
    (e) => e.status === 403,
  );
  await prisma.user.update({
    where: { id: actor.id },
    data: { banned: false, role: "operator" },
  });
  await assert.rejects(
    warehouses.create({ code: "DENIED", name: "Denied" }, actor.id),
    (e) => e.status === 403,
  );
}
