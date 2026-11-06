import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);

export async function createReceiptHttpContext(c) {
  const { Test } = require("@nestjs/testing");
  const { APP_GUARD, Reflector } = require("@nestjs/core");
  const { AuthGuard } = require("@thallesp/nestjs-better-auth");
  const { betterAuth } = require("better-auth");
  const { admin, customSession, username } = require("better-auth/plugins");
  const { hashPassword } = require("better-auth/crypto");
  const { roleAwarePrismaAdapter } = load("auth/role-aware-prisma-adapter.js");
  const { withEffectiveRoles } = load("auth/effective-session.js");
  const access = load("auth/better-auth-access.js");
  const { PermissionsGuard, AUTHENTICATE_REQUEST } = load(
    "auth/permissions.guard.js",
  );
  const { ACTIVE_MODULES } = load("config/active-modules.module.js");
  const { WarehouseReceiptsController } = load(
    "warehouse/receipts/receipts.controller.js",
  );
  const { WarehouseReceiptsService } = load(
    "warehouse/receipts/receipts.service.js",
  );
  const { WarehouseReceiptsQueryService } = load(
    "warehouse/receipts/receipts-query.service.js",
  );
  const { WarehouseReceiptPlacementsService } = load(
    "warehouse/receipts/receipt-placements.service.js",
  );
  const { WarehouseReceiptItemMappingService } = load(
    "warehouse/receipts/receipt-item-mapping.service.js",
  );
  const { WarehouseReceiptReconciliationService } = load(
    "warehouse/receipts/receipt-reconciliation.service.js",
  );
  const { WarehouseReceiptConflictResolutionService } = load(
    "warehouse/receipts/receipt-conflict-resolution.service.js",
  );
  const { ReceiptIntegrationWarehousesController } = load(
    "warehouse/receipt-integration/receipt-integration-warehouses.controller.js",
  );
  const { ReceiptIntegrationWarehousesService } = load(
    "warehouse/receipts/receipt-source-warehouses.service.js",
  );
  const auth = betterAuth({
    ...c.machineAuth.options,
    database: roleAwarePrismaAdapter(c.prisma, ["warehouse"]),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [
      ...c.machineAuth.options.plugins,
      username(),
      customSession((value) =>
        Promise.resolve(withEffectiveRoles(value, ["warehouse"])),
      ),
      admin({
        ac: access.ac,
        defaultRole: "operator",
        roles: {
          admin: access.adminRole,
          storekeeper: access.storekeeperRole,
          auditor: access.auditorRole,
        },
      }),
    ],
  });
  const cookies = {};
  const extraKeepers = await Promise.all(
    [2, 3].map((index) =>
      c.prisma.user.create({
        data: {
          id: `${c.namespace}-http-keeper-${index}`,
          name: `Keeper ${index}`,
          email: `${c.namespace}-http-keeper-${index}@test.invalid`,
          role: "storekeeper",
        },
      }),
    ),
  );
  for (const [name, user] of [
    ["admin", c.admin],
    ["keeper", c.keeper],
    ["keeper2", extraKeepers[0]],
    ["keeper3", extraKeepers[1]],
  ]) {
    const password = "Isolated-HTTP-fixture-password-123!";
    await c.prisma.account.create({
      data: {
        id: user.id,
        accountId: user.id,
        userId: user.id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    });
    const signedIn = await auth.api.signInEmail({
      body: { email: user.email, password },
      returnHeaders: true,
    });
    cookies[name] = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    assert.ok(cookies[name]);
  }
  const { IntegrationEventsService } = load(
    "integrations/integration-events.service.js",
  );
  const { IntegrationsController } = load(
    "integrations/integrations.controller.js",
  );
  const { IntegrationSourcesService } = load(
    "integrations/integration-sources.service.js",
  );
  const { IntegrationKeysService } = load(
    "integrations/integration-keys.service.js",
  );
  const { IntegrationRegistry } = load("integrations/integration-registry.js");
  const fixture = await Test.createTestingModule({
    controllers: [
      IntegrationsController,
      ReceiptIntegrationWarehousesController,
      WarehouseReceiptsController,
    ],
    providers: [
      {
        provide: ReceiptIntegrationWarehousesService,
        useValue: c.integrationWarehouses,
      },
      { provide: IntegrationEventsService, useValue: c.coreEvents },
      { provide: IntegrationSourcesService, useValue: c.coreSources },
      { provide: IntegrationKeysService, useValue: c.coreKeys },
      { provide: IntegrationRegistry, useValue: c.registry },
      { provide: WarehouseReceiptsService, useValue: c.receipts },
      { provide: WarehouseReceiptsQueryService, useValue: c.queries },
      { provide: WarehouseReceiptPlacementsService, useValue: c.placements },
      { provide: WarehouseReceiptItemMappingService, useValue: c.itemMapping },
      {
        provide: WarehouseReceiptReconciliationService,
        useValue: c.reconciliation,
      },
      {
        provide: WarehouseReceiptConflictResolutionService,
        useValue: c.conflictResolution,
      },
      { provide: ACTIVE_MODULES, useValue: ["warehouse"] },
      {
        provide: AUTHENTICATE_REQUEST,
        useFactory: (reflector) => {
          const guard = new AuthGuard(reflector, { auth });
          return (context) => guard.canActivate(context);
        },
        inject: [Reflector],
      },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  }).compile();
  const app = fixture.createNestApplication({
    logger: false,
    bodyParser: true,
  });
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const sensitive =
    /^(key|password|token|authorization|cookie|authorizationEncrypted)$/i;
  const redact = (value) =>
    JSON.parse(
      JSON.stringify(value, (name, entry) =>
        sensitive.test(name) ? "[REDACTED]" : entry,
      ),
    );
  async function request(method, path, { role, token, body, expected } = {}) {
    const started = performance.now();
    const response = await fetch(
      base + (path.startsWith("/") ? path : "/api/warehouse/" + path),
      {
        method,
        headers: {
          "content-type": "application/json",
          ...(role ? { cookie: cookies[role] } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
    );
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
    c.trace("http", {
      method,
      path,
      role: role ?? null,
      machineKeyPresent: !!token,
      request: redact(body ?? null),
      status: response.status,
      response: redact(result),
      durationMs: Math.round(performance.now() - started),
    });
    if (expected !== undefined)
      assert.equal(
        response.status,
        expected,
        `${method} ${path}: ${JSON.stringify(result)}`,
      );
    return { status: response.status, body: result, headers: response.headers };
  }
  return { request, auth, close: () => app.close() };
}
