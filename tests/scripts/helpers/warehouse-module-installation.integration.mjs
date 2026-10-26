import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { createIsolatedPostgres } from "./isolated-postgres.mjs";
import { runPackageMigrations } from "../../../scripts/database/migrate.mjs";
import { verifyWarehouseSchema } from "./warehouse-schema-test-context.mjs";
const project = resolve(import.meta.dirname, "../../..");
const require = createRequire(import.meta.url);
const quiet = { log() {} };
export async function verifyWarehouseModuleInstallation(test) {
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const environment = await createIsolatedPostgres();
  try {
    for (const [name, modules, fresh] of [
      ["warehouse_core", [], false],
      ["warehouse_equipment", ["equipment"], false],
      ["warehouse_ppe", ["ppe"], false],
      ["warehouse_all", ["equipment", "ppe"], false],
      ["warehouse_fresh", ["warehouse"], true],
    ]) {
      const root = join(environment.root, name);
      await mkdir(join(root, "backend/prisma/packages"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      for (const id of ["core", ...modules])
        await cp(
          join(project, "backend/prisma/packages", id),
          join(root, "backend/prisma/packages", id),
          { recursive: true },
        );
      const select = (selected) =>
        writeFile(
          join(root, "database-packages.json"),
          JSON.stringify({ modules: selected }),
        );
      await select(modules);
      const database = await environment.database(name);
      const url = environment.urlFor(name);
      const deploy = async () => {
        const result = await runPackageMigrations({
          projectRoot: root,
          databaseUrl: url,
          operation: "deploy",
          output: quiet,
        });
        assert.equal(result.ok, true, result.stdout + result.stderr);
      };
      await deploy();
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      try {
        const actor = await prisma.user.create({
          data: {
            id: "warehouse-user",
            name: "Existing user",
            email: "warehouse@test.invalid",
          },
        });
        const before = await prisma.user.findMany();
        if (!fresh) {
          assert.equal(
            (
              await database.query(
                "SELECT to_regclass('public.warehouse_items') AS name",
              )
            ).rows[0].name,
            null,
          );
          await cp(
            join(project, "backend/prisma/packages/warehouse"),
            join(root, "backend/prisma/packages/warehouse"),
            { recursive: true },
          );
          await select([...modules, "warehouse"]);
          await deploy();
          assert.deepEqual(await prisma.user.findMany(), before);
        }
        await test.test(name, (scenario) =>
          verifyWarehouseSchema(prisma, database, actor, scenario),
        );
        const linesBeforeRedeploy =
          await prisma.warehouseIssueSheetLine.findMany({
            orderBy: { id: "asc" },
          });
        const history = (
          await database.query(
            "SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name",
          )
        ).rows;
        await deploy();
        assert.deepEqual(
          (
            await database.query(
              "SELECT migration_name,checksum,finished_at FROM _prisma_migrations ORDER BY migration_name",
            )
          ).rows,
          history,
        );
        assert.deepEqual(
          await prisma.warehouseIssueSheetLine.findMany({
            orderBy: { id: "asc" },
          }),
          linesBeforeRedeploy,
        );
        assert.equal(
          (
            await runPackageMigrations({
              projectRoot: root,
              databaseUrl: url,
              operation: "status",
              output: quiet,
            })
          ).ok,
          true,
        );
      } finally {
        await prisma.$disconnect();
      }
    }
  } finally {
    await environment.close();
  }
}
