import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { verifyWarehouseCatalog } from "../../helpers/warehouse-catalog.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");

test(
  "warehouse catalog persists local items and audits atomically using core and warehouse only",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 120000,
  },
  async (t) => {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const environment = await createIsolatedPostgres();
    try {
      const root = join(environment.root, "warehouse_catalog");
      await mkdir(join(root, "backend/prisma"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      for (const id of ["core", "warehouse"])
        await cp(
          join(project, "backend/prisma/packages", id),
          join(root, "backend/prisma/packages", id),
          { recursive: true },
        );
      await writeFile(
        join(root, "database-packages.json"),
        '{"modules":["warehouse"]}',
      );
      const database = await environment.database("warehouse_catalog");
      const url = environment.urlFor("warehouse_catalog");
      const result = await runPackageMigrations({
        projectRoot: root,
        databaseUrl: url,
        operation: "deploy",
        output: { log() {} },
      });
      assert.equal(result.ok, true, result.stdout + result.stderr);
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      try {
        const actor = await prisma.user.create({
          data: {
            id: "catalog-storekeeper",
            name: "Storekeeper",
            email: "storekeeper@test.invalid",
            role: "storekeeper",
          },
        });
        await verifyWarehouseCatalog(prisma, actor, t);
        const optionalTables = (
          await database.query(
            "SELECT to_regclass('public.equipment') AS equipment, to_regclass('public.ppe_items') AS ppe",
          )
        ).rows[0];
        assert.equal(optionalTables.equipment, null);
        assert.equal(optionalTables.ppe, null);
      } finally {
        await prisma.$disconnect();
      }
    } finally {
      await environment.close();
    }
  },
);
