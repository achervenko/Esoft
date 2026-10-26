import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export async function verifyProjects(prisma) {
  const {
    WarehouseProjectsService,
  } = require("../../../backend/dist/src/warehouse/projects/projects.service.js");
  const service = new WarehouseProjectsService(prisma);
  const a = await prisma.warehouseProject.create({
    data: {
      id: 9007199254740993n,
      projectNumber: "250808",
      name: "Чаяндинское КЭНПО",
    },
  });
  const b = await prisma.warehouseProject.create({
    data: { projectNumber: "240205", name: "Хромпик", isActive: false },
  });
  const c = await prisma.warehouseProject.create({
    data: { projectNumber: "LITERAL-%_", name: null },
  });
  assert.deepEqual(await service.findOne(String(a.id)), {
    id: String(a.id),
    projectNumber: a.projectNumber,
    name: a.name,
    isActive: true,
  });
  assert.equal(
    (await service.list({ search: "чАяНд" })).items[0].id,
    String(a.id),
  );
  assert.equal((await service.list({ search: "250808" })).total, 1);
  assert.equal(
    (await service.list({ search: "%_" })).items[0].id,
    String(c.id),
  );
  const inactive = await service.list({ isActive: "false" });
  assert.equal(inactive.total, 1);
  assert.deepEqual(
    inactive.items.map((item) => item.id),
    [String(b.id)],
  );
  const active = await service.list({ isActive: "true" });
  assert.equal(active.total, 2);
  assert.deepEqual(
    active.items.map((item) => item.id),
    [String(a.id), String(c.id)],
  );
  const all = await service.list({});
  assert.equal(all.total, 3);
  assert.deepEqual(
    (await service.list({ page: "2", limit: "1" })).items,
    all.items.slice(1, 2),
  );
  await assert.rejects(
    service.findOne("9223372036854775807"),
    (e) => e.response?.code === "WAREHOUSE_PROJECT_NOT_FOUND",
  );
  await assert.rejects(
    service.findOne("00015"),
    (e) => e.response?.code === "WAREHOUSE_STOCK_ID_INVALID",
  );
  assert.equal(await prisma.auditLog.count(), 0);
}
