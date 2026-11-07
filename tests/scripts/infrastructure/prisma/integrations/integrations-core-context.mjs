import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createIsolatedPostgres } from "../../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../../scripts/database/migrate.mjs";
const require = createRequire(import.meta.url),
  project = resolve(import.meta.dirname, "../../../../.."),
  load = (p) => require(join(project, "backend/dist/src", p));
export async function createIntegrationsCoreContext({
  withOrders = false,
} = {}) {
  const environment = await createIsolatedPostgres();
  let prisma;
  const close = async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      await environment.close();
    }
  };
  try {
    const root = join(environment.root, "integrations");
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
    if (withOrders) {
      await cp(
        join(project, "backend/prisma/packages/orders"),
        join(root, "backend/prisma/packages/orders"),
        { recursive: true },
      );
    }
    await writeFile(
      join(root, "database-packages.json"),
      JSON.stringify({ modules: withOrders ? ["orders"] : [] }),
    );
    await environment.database("integrations");
    const url = environment.urlFor("integrations");
    const migrated = await runPackageMigrations({
      projectRoot: root,
      databaseUrl: url,
      operation: "deploy",
      output: { log() {} },
    });
    assert.equal(migrated.ok, true, migrated.stdout + migrated.stderr);
    const { PrismaClient } = require("@prisma/client"),
      { PrismaPg } = require("@prisma/adapter-pg");
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const { betterAuth } = require("better-auth"),
      { prismaAdapter } = require("better-auth/adapters/prisma");
    const { machineApiKeyPlugin } = load("auth/machine-api-key.plugin.js"),
      { MachineApiKeysService } = load("auth/machine-api-keys.service.js");
    const auth = betterAuth({
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      secret: "core-integration-test-secret-only-32",
      baseURL: "http://localhost:3000",
      plugins: [machineApiKeyPlugin()],
      logger: { disabled: true },
    });
    const machine = new MachineApiKeysService(
      { api: auth.api, instance: auth },
      prisma,
    );
    const { IntegrationRegistry } = load(
        "integrations/integration-registry.js",
      ),
      { OneCIntegrationAdapter } = load(
        "integrations/adapters/one-c.adapter.js",
      );
    const { IntegrationFlowsService } = load(
      "integrations/integration-flows.service.js",
    );
    const { IntegrationSourcesService } = load(
        "integrations/integration-sources.service.js",
      ),
      { IntegrationKeysService } = load(
        "integrations/integration-keys.service.js",
      ),
      { IntegrationEventsService } = load(
        "integrations/integration-events.service.js",
      ),
      { IntegrationWorkerService } = load(
        "integrations/integration-worker.service.js",
      );
    const { IntegrationFailure } = load("integrations/integration-errors.js");
    const registry = new IntegrationRegistry();
    const adapter = new OneCIntegrationAdapter(registry);
    adapter.onModuleInit();
    const seen = [];
    let behavior = "ok";
    const flow = (code) => ({
      flowCode: code,
      name: code,
      owner: "test",
      systemTypes: ["ONE_C"],
      configVersions: [1],
      incomingActions: ["event:create"],
      validateConfig(version, config) {
        assert.equal(version, 1);
        assert.deepEqual(config, {});
      },
      validateEvent() {},
      async handle(context) {
        if (behavior === "permanent")
          throw new IntegrationFailure("TEST_PERMANENT", false);
        if (behavior === "retry") throw Error("DO-NOT-LOG-secret");
        seen.push(context.event.objectId + ":" + code);
      },
    });
    registry.registerFlow(flow("test.first"));
    registry.registerFlow(flow("test.second"));
    const { AuditLogService } = load("audit/audit-log.service.js");
    const actualAudit = new AuditLogService(prisma);
    let auditFails = false;
    const audit = {
      async writeFieldChanges(params) {
        if (auditFails === true || auditFails === params.entityType)
          throw Error("audit failed");
        return actualAudit.writeFieldChanges(params);
      },
    };
    const sources = new IntegrationSourcesService(
        prisma,
        registry,
        audit,
        new IntegrationFlowsService(prisma, registry, audit),
      ),
      keys = new IntegrationKeysService(prisma, machine, registry, audit),
      events = new IntegrationEventsService(prisma, machine, audit, registry),
      worker = new IntegrationWorkerService(prisma, registry),
      otherWorker = new IntegrationWorkerService(prisma, registry);
    const admin = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: "Admin",
        email: randomUUID() + "@test.invalid",
        role: "admin",
      },
    });
    const source = await sources.create(
      {
        name: "1С — основная",
        systemType: "ONE_C",
        baseUrl: "http://127.0.0.1:1/",
        authorization: "Bearer secret",
      },
      admin.id,
    );
    for (const code of ["test.first", "test.second"])
      await sources.configureFlow(
        source.code,
        code,
        { isActive: true, configVersion: 1, config: {} },
        admin.id,
      );
    const key = await keys.create(
      source.code,
      { name: "first flow", flows: { "test.first": ["event:create"] } },
      admin.id,
    );
    const payload = (patch = {}) => ({
      eventId: randomUUID(),
      objectId: randomUUID(),
      type: "UPDATED",
      version: "opaque-version-A",
      ...patch,
    });
    const accept = (body, code = "test.first", token = key.key) =>
      events.accept(source.code, code, body, `Bearer ${token}`);
    return {
      prisma,
      registry,
      sources,
      keys,
      events,
      machine,
      worker,
      otherWorker,
      admin,
      source,
      key,
      payload,
      accept,
      seen,
      project,
      root,
      url,
      createWorkerWithoutHandlers() {
        const empty = new IntegrationRegistry();
        new OneCIntegrationAdapter(empty).onModuleInit();
        return new IntegrationWorkerService(prisma, empty);
      },
      setBehavior(value) {
        behavior = value;
      },
      setAuditFails(value) {
        auditFails = value;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
