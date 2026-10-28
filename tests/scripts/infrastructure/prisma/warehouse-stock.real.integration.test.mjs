import { verifyStockOverview } from "../../helpers/warehouse-stock-overview.mjs";
import { createStockTestContext } from "../../helpers/warehouse-stock-test-context.mjs";
import { verifyStockBasic } from "../../helpers/warehouse-stock.basic.mjs";
import { verifyStockQuery } from "../../helpers/warehouse-stock-query.mjs";
import { verifyStockErrors } from "../../helpers/warehouse-stock-errors.mjs";
import { verifyStockActivity } from "../../helpers/warehouse-stock-activity.mjs";
import { verifyStockAtomicity } from "../../helpers/warehouse-stock-atomicity.mjs";
import { verifyStockConcurrency } from "../../helpers/warehouse-stock-concurrency.mjs";
import { verifyStockLocking } from "../../helpers/warehouse-stock-locking.mjs";
import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");

test(
  "Stock works transactionally with core + warehouse, including concurrent mutations",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 180000,
  },
  async (t) => {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const environment = await createIsolatedPostgres();
    try {
      const root = join(environment.root, "warehouse_stock");
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
      const database = await environment.database("warehouse_stock");
      const url = environment.urlFor("warehouse_stock");
      const deployed = await runPackageMigrations({
        projectRoot: root,
        databaseUrl: url,
        operation: "deploy",
        output: { log() {} },
      });
      assert.equal(deployed.ok, true, deployed.stdout + deployed.stderr);
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url, max: 16 }),
      });
      try {
        for (const [name, verify] of [
          ["basic", verifyStockBasic],
          ["query", verifyStockQuery],
          ["overview", verifyStockOverview],
          ["errors", verifyStockErrors],
          ["activity", verifyStockActivity],
          ["atomicity", verifyStockAtomicity],
          ["concurrency", verifyStockConcurrency],
          ["locking", verifyStockLocking],
        ]) {
          await t.test(name, async (suite) => {
            await verify(await createStockTestContext(prisma, database), suite);
          });
        }
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
