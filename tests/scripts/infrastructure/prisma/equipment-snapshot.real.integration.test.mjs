import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createIntegrationsCoreContext } from "./integrations/integrations-core-context.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
const require = createRequire(import.meta.url);
const {
  EquipmentQueryService,
} = require("../../../../backend/dist/src/equipment/equipment-query.service.js");
test(
  "equipment registry keeps count, page and hydration in one snapshot during concurrent writes",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async () => {
    const c = await createIntegrationsCoreContext();
    let writer;
    try {
      await cp(
        join(c.project, "backend/prisma/packages/equipment"),
        join(c.root, "backend/prisma/packages/equipment"),
        { recursive: true },
      );
      await writeFile(
        join(c.root, "database-packages.json"),
        '{"modules":["equipment"]}',
      );
      const migration = await runPackageMigrations({
        projectRoot: c.root,
        databaseUrl: c.url,
        operation: "deploy",
        output: { log() {} },
      });
      assert.equal(migration.ok, true, migration.stdout + migration.stderr);
      const { PrismaClient } = require("@prisma/client"),
        { PrismaPg } = require("@prisma/adapter-pg");
      writer = new PrismaClient({
        adapter: new PrismaPg({ connectionString: c.url }),
      });
      const p = c.prisma;
      const manufacturer = await p.manufacturer.create({
        data: { name: "Snapshot" },
      });
      const model = await p.equipmentModel.create({
        data: { name: "Model", manufacturerId: manufacturer.id },
      });
      const workshop = await p.workshop.create({ data: { name: "Workshop" } });
      const section = await p.section.create({
        data: { name: "Section", workshopId: workshop.id },
      });
      const position = await p.position.create({ data: { name: "Snapshot" } });
      const employee = await p.employee.create({
        data: {
          firstName: "Test",
          lastName: "Snapshot",
          positionId: position.id,
        },
      });
      const data = {
        name: "Same name",
        modelId: model.id,
        sectionId: section.id,
        responsibleEmployeeId: employee.id,
        issueDate: new Date("2026-11-08"),
      };
      const first = await p.equipment.create({
        data: { ...data, inventoryNumber: "SNAP-1" },
      });
      const second = await p.equipment.create({
        data: { ...data, inventoryNumber: "SNAP-2" },
      });
      const service = new EquipmentQueryService(null, p);
      const before = await service.findAll();
      let inserted;
      function interleave(at, mutate) {
        let fired = false;
        return new Proxy(p, {
          get(target, key) {
            if (key !== "$transaction") return Reflect.get(target, key);
            return (fn, options) =>
              target.$transaction(
                (tx) =>
                  fn(
                    new Proxy(tx, {
                      get(inner, prop) {
                        if (prop === "equipment")
                          return new Proxy(inner.equipment, {
                            get(delegate, method) {
                              const value = Reflect.get(delegate, method);
                              if (method !== at)
                                return typeof value === "function"
                                  ? value.bind(delegate)
                                  : value;
                              return async (...args) => {
                                const result = await value.apply(
                                  delegate,
                                  args,
                                );
                                if (!fired) {
                                  fired = true;
                                  await mutate();
                                }
                                return result;
                              };
                            },
                          });
                        if (prop === "$queryRaw" && at === "$queryRaw")
                          return async (...args) => {
                            const result = await inner.$queryRaw(...args);
                            if (!fired) {
                              fired = true;
                              await mutate();
                            }
                            return result;
                          };
                        return Reflect.get(inner, prop);
                      },
                    }),
                  ),
                options,
              );
          },
        });
      }
      const during = new EquipmentQueryService(
        null,
        interleave("count", async () => {
          await writer.equipment.delete({ where: { id: second.id } });
          inserted = await writer.equipment.create({
            data: { ...data, inventoryNumber: "SNAP-3" },
          });
        }),
      );
      assert.deepEqual(await during.findAll(), before);
      const after = await service.findAll();
      assert.deepEqual(
        after.items.map((r) => r.id),
        [first.id, inserted.id],
      );
      const rename = new EquipmentQueryService(
        null,
        interleave("$queryRaw", () =>
          writer.equipment.update({
            where: { id: first.id },
            data: { name: "Changed concurrently" },
          }),
        ),
      );
      assert.deepEqual(await rename.findAll(), after);
      assert.equal(
        (await service.findAll()).items[0].name,
        "Changed concurrently",
      );
      for (const sort of [
        "visibleId",
        "name",
        "inventoryNumber",
        "serialNumber",
        "manufacturer",
        "model",
        "statusLabel",
      ])
        for (const direction of ["asc", "desc"]) {
          const all = await service.findAll({ sort, direction });
          const pages = [];
          for (const page of ["1", "2"])
            pages.push(
              await service.findAll({ sort, direction, page, limit: "1" }),
            );
          assert.deepEqual(
            pages.flatMap((p) => p.items),
            all.items,
          );
          assert.ok(pages.every((p) => p.total === 2));
          assert.deepEqual(
            await service.findAll({ sort, direction, page: "3", limit: "1" }),
            { items: [], total: 2, page: 3, limit: 1 },
          );
        }
    } finally {
      await writer?.$disconnect();
      await c.close();
    }
  },
);
