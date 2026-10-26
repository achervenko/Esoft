import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { verifyWarehouseIssues } from "../../helpers/warehouse-issues.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");
test(
  "Issues availability, reservations, confirmed overrides, concurrency and atomicity",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 120000,
  },
  async () => {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const environment = await createIsolatedPostgres();
    try {
      const root = join(environment.root, "warehouse_issues");
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
      await environment.database("warehouse_issues");
      const url = environment.urlFor("warehouse_issues");
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
        await verifyWarehouseIssues(prisma);
      } finally {
        await prisma.$disconnect();
      }
    } finally {
      await environment.close();
    }
  },
);
