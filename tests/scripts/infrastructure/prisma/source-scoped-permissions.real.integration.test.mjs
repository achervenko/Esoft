import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, cp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
const require = createRequire(import.meta.url),
  project = resolve(import.meta.dirname, "../../../..");
test(
  "source-scoped actor permissions: fresh install, shared actors and database constraints",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async () => {
    const env = await createIsolatedPostgres();
    try {
      const root = join(env.root, "permissions");
      await mkdir(join(root, "backend/prisma"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      await cp(
        join(project, "backend/prisma/packages/core"),
        join(root, "backend/prisma/packages/core"),
        { recursive: true },
      );
      await writeFile(join(root, "database-packages.json"), '{"modules":[]}');
      const db = await env.database("permissions"),
        url = env.urlFor("permissions");
      const deploy = () =>
        runPackageMigrations({
          projectRoot: root,
          databaseUrl: url,
          operation: "deploy",
          output: { log() {} },
        });
      const result = await deploy();
      assert.equal(result.ok, true, result.stdout + result.stderr);
      const retired = await db.query(
        "SELECT to_regclass('warehouse_receipt_events') AS events, to_regclass('warehouse_receipt_integration_sources') AS sources, to_regclass('integration_event_aliases') AS aliases",
      );
      assert.deepEqual(retired.rows[0], {
        events: null,
        sources: null,
        aliases: null,
      });

      const actor = randomUUID(),
        ordinary = randomUUID(),
        single = randomUUID(),
        a = randomUUID(),
        b = randomUUID(),
        c = randomUUID();
      for (const [id, role] of [
        [actor, "system:integration"],
        [ordinary, "operator"],
        [single, "system:integration"],
      ])
        await db.query(
          'INSERT INTO "user"(id,name,email,role,"updatedAt") VALUES($1,$1,$2,$3,now())',
          [id, `${id}@test.invalid`, role],
        );
      for (const [id, owner] of [
        [a, actor],
        [b, actor],
        [c, single],
      ])
        await db.query(
          "INSERT INTO integration_sources(id,code,name,system_type,base_url,authorization_encrypted,actor_user_id,updated_at) VALUES($1::text::uuid,$1::text,$1::text,'ONE_C','http://127.0.0.1/','test',$2,now())",
          [id, owner],
        );
      const { PrismaClient } = require("@prisma/client"),
        { PrismaPg } = require("@prisma/adapter-pg");
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      try {
        await prisma.systemActorPermission.create({
          data: {
            sourceId: c,
            actorUserId: single,
            permission: "warehouse.receipts.integration",
          },
        });
        const rows = await prisma.integrationSourceActor.findMany({
          where: { actorUserId: actor },
        });
        assert.equal(rows.length, 2);
        const migrated = await prisma.systemActorPermission.findMany();
        assert.deepEqual(
          migrated.map((g) => ({
            sourceId: g.sourceId,
            actorUserId: g.actorUserId,
            permission: g.permission,
          })),
          [
            {
              sourceId: c,
              actorUserId: single,
              permission: "warehouse.receipts.integration",
            },
          ],
        );
        await assert.rejects(
          prisma.systemActorPermission.create({
            data: {
              sourceId: a,
              actorUserId: ordinary,
              permission: "warehouse.receipts.integration",
            },
          }),
          (e) => e.code === "P2003",
        );
        await assert.rejects(
          prisma.systemActorPermission.create({
            data: {
              sourceId: a,
              actorUserId: single,
              permission: "warehouse.receipts.integration",
            },
          }),
          (e) => e.code === "P2003",
        );
        await prisma.systemActorPermission.create({
          data: {
            sourceId: a,
            actorUserId: actor,
            permission: "warehouse.receipts.integration",
          },
        });
        const { assertTransactionPermission } = require(
          join(project, "backend/dist/src/auth/transaction-permission.js"),
        );
        await prisma.$transaction((tx) =>
          assertTransactionPermission(
            tx,
            actor,
            "warehouse.receipts.integration",
            a,
          ),
        );
        await assert.rejects(
          prisma.$transaction((tx) =>
            assertTransactionPermission(
              tx,
              actor,
              "warehouse.receipts.integration",
              b,
            ),
          ),
          (e) => e.response?.code === "FORBIDDEN",
        );
        await assert.rejects(
          prisma.$transaction((tx) =>
            assertTransactionPermission(
              tx,
              actor,
              "warehouse.receipts.integration",
            ),
          ),
          (e) => e.response?.code === "FORBIDDEN",
        );
        await prisma.systemActorPermission.create({
          data: {
            sourceId: b,
            actorUserId: actor,
            permission: "warehouse.receipts.integration",
          },
        });
        assert.equal(
          await prisma.systemActorPermission.count({
            where: { actorUserId: actor },
          }),
          2,
        );
        await assert.rejects(
          prisma.systemActorPermission.create({
            data: {
              sourceId: b,
              actorUserId: actor,
              permission: "warehouse.receipts.integration",
            },
          }),
          (e) => e.code === "P2002",
        );
        await assert.rejects(
          prisma.integrationSourceActor.delete({ where: { sourceId: a } }),
          (e) => e.code === "P2003",
        );
        const future = randomUUID();
        await db.query(
          "INSERT INTO integration_sources(id,code,name,system_type,base_url,authorization_encrypted,actor_user_id,updated_at) VALUES($1::text::uuid,$1::text,$1::text,'ONE_C','http://127.0.0.1/','test',$2,now())",
          [future, actor],
        );
        assert.equal(
          (
            await prisma.integrationSourceActor.findUniqueOrThrow({
              where: { sourceId: future },
            })
          ).actorUserId,
          actor,
        );
        await assert.rejects(
          prisma.integrationSourceActor.update({
            where: { sourceId: future },
            data: { actorUserId: ordinary },
          }),
          (e) => e.code === "P2003",
        );
      } finally {
        await prisma.$disconnect();
      }
      const replay = await deploy();
      assert.equal(replay.ok, true, replay.stdout + replay.stderr);
    } finally {
      await env.close();
    }
  },
);
