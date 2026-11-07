import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import packageTools from "../../../../scripts/database/packages.cjs";

const project = resolve(import.meta.dirname, "../../../..");
const run = promisify(execFile);
const release = "7a434387";

test(
  "version 1.0.2 upgrades without changing released SQL or stored data",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 120_000,
  },
  async () => {
    const environment = await createIsolatedPostgres();
    try {
      const root = join(environment.root, "release");
      await mkdir(join(root, "backend/prisma"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      for (const id of ["core", "equipment", "ppe"]) {
        const base = "backend/prisma/packages/" + id;
        const { stdout } = await run(
          "git",
          ["show", release + ":" + base + "/manifest.json"],
          { cwd: project },
        );
        const manifest = JSON.parse(stdout);
        for (const migration of manifest.migrations) {
          const file = base + "/migrations/" + migration.id + "/migration.sql";
          const { stdout: sql } = await run(
            "git",
            ["show", release + ":" + file],
            { cwd: project, encoding: "buffer", maxBuffer: 10_000_000 },
          );
          const directory = join(root, base, "migrations", migration.id);
          await mkdir(directory, { recursive: true });
          await writeFile(join(directory, "migration.sql"), sql);
        }
        await writeFile(join(root, base, "manifest.json"), stdout);
      }
      await writeFile(
        join(root, "database-packages.json"),
        JSON.stringify({ modules: ["equipment", "ppe"] }),
      );
      const database = await environment.database("release");
      const databaseUrl = environment.urlFor("release");
      const lockChecks = [];
      const deploy = () =>
        runPackageMigrations({
          projectRoot: root,
          databaseUrl,
          operation: "deploy",
          output: {
            log() {
              lockChecks.push(
                database.query(
                  "SELECT pg_try_advisory_lock(hashtext('esoft-package-migrations'), hashtext(current_database())) AS locked",
                ),
              );
            },
          },
        });
      assert.equal((await deploy()).ok, true);
      await database.query(
        `INSERT INTO "user"(id,name,email,"updatedAt") VALUES ('release-probe','Release data','release@test.invalid',now())`,
      );
      const user = (
        await database.query(`SELECT * FROM "user" WHERE id='release-probe'`)
      ).rows;
      const historySql =
        "SELECT id,migration_name,checksum,started_at,finished_at FROM _prisma_migrations ORDER BY started_at,id";
      const before = (await database.query(historySql)).rows;
      await cp(
        join(project, "backend/prisma/packages"),
        join(root, "backend/prisma/packages"),
        { recursive: true },
      );
      await writeFile(
        join(root, "database-packages.json"),
        JSON.stringify({ modules: ["warehouse", "ppe", "equipment"] }),
      );
      const result = await deploy();
      assert.equal(result.ok, true, result.stderr);
      const after = (await database.query(historySql)).rows;
      assert.deepEqual(after.slice(0, before.length), before);
      assert.deepEqual(
        (await database.query(`SELECT * FROM "user" WHERE id='release-probe'`))
          .rows,
        user,
      );
      const previouslyApplied = new Set(
        before.map((row) => row.migration_name),
      );
      const pending = packageTools
        .readPackageSet(root)
        .migrations.filter((row) => !previouslyApplied.has(row.id));
      assert.deepEqual(
        after.slice(before.length).map((row) => row.migration_name),
        pending.map((row) => row.id),
      );
      assert.deepEqual(
        after.slice(before.length).map((row) => row.checksum),
        pending.map((row) => row.sha256),
      );
      assert.equal((await deploy()).ok, true);
      assert.deepEqual((await database.query(historySql)).rows, after);
      for (const check of await Promise.all(lockChecks))
        assert.equal(
          check.rows[0].locked,
          false,
          "migration lock must span every Prisma invocation",
        );
      assert.equal(
        (
          await database.query(
            "SELECT pg_try_advisory_lock(hashtext('esoft-package-migrations'), hashtext(current_database())) AS locked",
          )
        ).rows[0].locked,
        true,
      );
      await database.query(
        "SELECT pg_advisory_unlock(hashtext('esoft-package-migrations'), hashtext(current_database()))",
      );
    } finally {
      await environment.close();
    }
  },
);
