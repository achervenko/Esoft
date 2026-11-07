import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { createReceiptTestContext } from "../../helpers/warehouse-receipts-test-context.mjs";
import { createReceiptHttpContext } from "../../helpers/warehouse-receipts-http-context.mjs";
import { adversarialReceiptHttp } from "../../helpers/warehouse-receipts-http.adversarial.mjs";
import { adversarialReceiptTransport } from "../../helpers/warehouse-receipts-transport.adversarial.mjs";
import { adversarialReceiptAtomicity } from "../../helpers/warehouse-receipts-faults.adversarial.mjs";
import { adversarialReceiptModel } from "../../helpers/warehouse-receipts-model.adversarial.mjs";
import { adversarialReceiptWorker } from "../../helpers/warehouse-receipts-worker.adversarial.mjs";
import { adversarialReceiptResponseLoss } from "../../helpers/warehouse-receipts-response-loss.adversarial.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");
test(
  "Adversarial receipts: real HTTP/auth/SQL, transport faults and independent stock oracle",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 240000,
  },
  async (t) => {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const environment = await createIsolatedPostgres();
    const tracePath = process.env.ESOFT_RECEIPTS_TRACE;
    const records = [];
    let queries = 0,
      assertions = 0;
    const trace = (phase, data = {}) => {
      if (phase !== "sql") assertions++;
      if (tracePath)
        records.push({ at: new Date().toISOString(), phase, ...data });
    };
    try {
      const root = join(environment.root, "receipts_adversarial");
      await mkdir(join(root, "backend/prisma"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      for (const name of ["core", "orders", "warehouse"])
        await cp(
          join(project, "backend/prisma/packages", name),
          join(root, "backend/prisma/packages", name),
          { recursive: true },
        );
      await writeFile(
        join(root, "database-packages.json"),
        '{"modules":["warehouse"]}',
      );
      const database = await environment.database("receipts_adversarial");
      const url = environment.urlFor("receipts_adversarial");
      const migrated = await runPackageMigrations({
        projectRoot: root,
        databaseUrl: url,
        operation: "deploy",
        output: { log() {} },
      });
      assert.equal(migrated.ok, true, migrated.stdout + migrated.stderr);
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url, max: 30 }),
        log: [{ emit: "event", level: "query" }],
      });
      // Test-only SQL diagnostics deliberately omit params: they can contain credentials.
      prisma.$on("query", (event) => {
        queries++;
        trace("sql", { query: event.query, durationMs: event.duration });
      });
      let http;
      try {
        const c = await createReceiptTestContext(prisma);
        const secrets = [
          "isolated-outgoing-secret",
          "isolated-source-secret",
          "source-secret-must-not-appear",
        ];
        const createKey = c.machineKeys.create.bind(c.machineKeys);
        c.machineKeys.create = async (...args) => {
          const key = await createKey(...args);
          secrets.push(key.key);
          return key;
        };
        const {
          AuditLogService,
        } = require("../../../../backend/dist/src/audit/audit-log.service.js");
        c.realAudit = new AuditLogService(prisma);
        c.audit.writeFieldChanges = (params) =>
          c.realAudit.writeFieldChanges(params);
        c.trace = trace;
        c.database = database;
        http = await createReceiptHttpContext(c);
        await adversarialReceiptHttp(c, http, t);
        await adversarialReceiptTransport(c, t);
        await adversarialReceiptAtomicity(c, http, t);
        await adversarialReceiptWorker(c, t);
        await adversarialReceiptModel(c, t);
        await adversarialReceiptResponseLoss(c, http, t);
        const bad =
          await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM warehouse_balances WHERE quantity < 0`;
        assert.equal(bad[0].count, 0);
        const diagnosticText = JSON.stringify(records);
        for (const secret of secrets)
          assert.ok(
            !diagnosticText.includes(secret),
            "Credentials must never enter diagnostics",
          );
        trace("final", {
          queries,
          checkpoints: assertions,
          negativeBalances: 0,
          leakedSecrets: 0,
        });
      } finally {
        await http?.close();
        await prisma.$disconnect();
      }
    } finally {
      await environment.close();
      if (tracePath)
        await writeFile(
          tracePath,
          records
            .map((row) =>
              JSON.stringify(row, (_, value) =>
                typeof value === "bigint" ? String(value) : value,
              ),
            )
            .join("\n") + "\n",
        );
    }
  },
);
