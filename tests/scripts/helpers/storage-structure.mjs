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
  const a = await warehouses.create({ name: " Проектный склад " }, actor.id);
  const b = await warehouses.create({ name: "Электрики" }, actor.id);
  assert.equal(a.name, "Проектный склад");
  assert.equal(typeof a.id, "string");
  assert.equal(a.isActive, true);
  await assert.rejects(
    warehouses.create({ name: a.name }, actor.id),
    code("WAREHOUSE_NAME_CONFLICT"),
  );
  await assert.rejects(
    warehouses.update(b.id, { name: a.name }, actor.id),
    code("WAREHOUSE_NAME_CONFLICT"),
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
    { warehouseId: a.id, name: "Угол ангара" },
    actor.id,
  );
  const y = await locations.create(
    { warehouseId: b.id, name: "Палетоместо" },
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
    locations.create({ warehouseId: a.id, name: x.name }, actor.id),
    code("WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT"),
  );
  await assert.rejects(
    locations.create({ name: "Missing warehouse" }, actor.id),
    code("INVALID_WAREHOUSE_ID"),
  );
  await assert.rejects(
    locations.create(
      {
        warehouseId: "9223372036854775807",

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
    locations.create({ warehouseId: a.id, name: "New" }, actor.id),
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
    failing.create({ name: "Rollback" }, actor.id),
    /audit unavailable/,
  );
  assert.equal(
    await prisma.warehouse.count({ where: { name: "Rollback" } }),
    0,
  );
  await assert.rejects(
    failing.update(a.id, { name: "Wrong" }, actor.id),
    /audit unavailable/,
  );
  assert.equal((await warehouses.findOne(a.id)).name, a.name);
  // Restoration keeps identifiers, balances, reservations and existing audit rows.
  const parent = await warehouses.create({ name: "Restore" }, actor.id);
  const place = await locations.create(
    { warehouseId: parent.id, name: "Restore" },
    actor.id,
  );
  const item = await prisma.warehouseItem.create({
    data: { article: "RESTORE", name: "Restore", unit: "шт" },
  });
  const balance = await prisma.warehouseBalance.create({
    data: {
      itemId: item.id,
      storageLocationId: BigInt(place.id),
      quantity: "5",
    },
  });
  const project = await prisma.warehouseProject.create({
    data: { projectNumber: "RESTORE" },
  });
  const reservation = await prisma.warehouseProjectReservation.create({
    data: { balanceId: balance.id, projectId: project.id, quantity: "2" },
  });
  const oldAudit = await prisma.auditLog.findMany({
    where: {
      entityType: "warehouse_storage_location",
      entityStringId: place.id,
    },
  });
  await locations.update(place.id, { isActive: false }, actor.id);
  await warehouses.update(parent.id, { isActive: false }, actor.id);
  await assert.rejects(
    locations.create({ warehouseId: parent.id, name: place.name }, actor.id),
    code("WAREHOUSE_INACTIVE"),
  );
  await assert.rejects(
    failing.create({ name: parent.name }, actor.id),
    /audit unavailable/,
  );
  assert.equal((await warehouses.findOne(parent.id)).isActive, false);
  assert.equal((await warehouses.findOne(parent.id)).name, parent.name);
  const restoredParent = await warehouses.create(
    { name: parent.name },
    actor.id,
  );
  assert.equal(restoredParent.id, parent.id);
  assert.equal(restoredParent.name, parent.name);
  assert.equal((await locations.findOne(place.id)).isActive, false);
  const failingLocations = new WarehouseStorageLocationsService(
    prisma,
    failAudit,
  );
  await assert.rejects(
    failingLocations.create(
      { warehouseId: parent.id, name: place.name },
      actor.id,
    ),
    /audit unavailable/,
  );
  assert.equal((await locations.findOne(place.id)).isActive, false);
  assert.equal((await locations.findOne(place.id)).name, place.name);
  const restoredPlace = await locations.create(
    { warehouseId: parent.id, name: place.name },
    actor.id,
  );
  assert.equal(restoredPlace.id, place.id);
  assert.equal(restoredPlace.name, place.name);
  assert.equal(restoredPlace.isActive, true);
  assert.equal(
    (
      await prisma.warehouseBalance.findUniqueOrThrow({
        where: { id: balance.id },
      })
    ).quantity.toString(),
    "5",
  );
  assert.equal(
    (
      await prisma.warehouseProjectReservation.findUniqueOrThrow({
        where: { id: reservation.id },
      })
    ).quantity.toString(),
    "2",
  );
  for (const row of oldAudit)
    assert.deepEqual(
      await prisma.auditLog.findUnique({ where: { id: row.id } }),
      row,
    );
  const restorationAudit = await prisma.auditLog.findMany({
    where: {
      entityType: "warehouse_storage_location",
      entityStringId: place.id,
      action: "UPDATE",
    },
  });
  assert.ok(
    restorationAudit.some(
      (row) => row.fieldName === "Активность" && row.newValue === "true",
    ),
  );
  for (const kind of ["warehouse", "location"]) {
    await locations.update(place.id, { isActive: false }, actor.id);
    await warehouses.update(
      parent.id,
      { isActive: kind === "location" },
      actor.id,
    );
    const restore =
      kind === "warehouse"
        ? () => warehouses.create({ name: parent.name }, actor.id)
        : () =>
            locations.create(
              { warehouseId: parent.id, name: place.name },
              actor.id,
            );
    const attempts = await Promise.allSettled([restore(), restore()]);
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    const success = attempts.find((r) => r.status === "fulfilled");
    assert.equal(success.value.id, kind === "warehouse" ? parent.id : place.id);
    assert.equal(
      attempts.find((r) => r.status === "rejected").reason.response.code,
      kind === "warehouse"
        ? "WAREHOUSE_NAME_CONFLICT"
        : "WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT",
    );
  }
  const concurrent = await Promise.allSettled([
    warehouses.create({ name: "RACE-WAREHOUSE" }, actor.id),
    warehouses.create({ name: "RACE-WAREHOUSE" }, actor.id),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((r) => r.status === "rejected").reason.response.code,
    "WAREHOUSE_NAME_CONFLICT",
  );
  for (const action of ["create", "activate"]) {
    const parent = await warehouses.create(
      { name: "Race " + action },
      actor.id,
    );
    const inactive = await locations.create(
      {
        warehouseId: parent.id,

        name: "Inactive",
        isActive: false,
      },
      actor.id,
    );
    const results = await Promise.allSettled([
      warehouses.update(parent.id, { isActive: false }, actor.id),
      action === "create"
        ? locations.create({ warehouseId: parent.id, name: "New" }, actor.id)
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
    warehouses.create({ name: "Denied" }, actor.id),
    (e) => e.status === 403,
  );
}
