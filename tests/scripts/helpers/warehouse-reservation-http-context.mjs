import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);
const reservations = (path) => load("warehouse/reservations/" + path);

export async function startReservationHttp(c) {
  const { Test } = require("@nestjs/testing");
  const { APP_GUARD, Reflector } = require("@nestjs/core");
  const { AuthGuard } = require("@thallesp/nestjs-better-auth");
  const { betterAuth } = require("better-auth");
  const { prismaAdapter } = require("better-auth/adapters/prisma");
  const { hashPassword } = require("better-auth/crypto");
  const { admin: adminPlugin } = require("better-auth/plugins");
  const { WarehouseReservationsModule } = reservations(
    "reservations.module.js",
  );
  const { WarehouseReceiptsModule } = load(
    "warehouse/receipts/receipts.module.js",
  );
  const { PrismaService } = load("prisma/prisma.service.js");
  const { STORAGE_CONFIG } = load("storage/storage.tokens.js");
  const { PermissionsGuard, AUTHENTICATE_REQUEST } = load(
    "auth/permissions.guard.js",
  );
  const { ACTIVE_MODULES } = load("config/active-modules.module.js");
  const auth = betterAuth({
    database: prismaAdapter(c.prisma, { provider: "postgresql" }),
    secret: "reservation-http-test-only-secret-32-characters",
    baseURL: "http://localhost:3000",
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [adminPlugin()],
    logger: { disabled: true },
  });
  const cookies = new Map();
  const users = {};
  const password = "Isolated-test-credential-123!";
  const hash = await hashPassword(password);
  for (const [name, role] of [
    ["admin", "admin"],
    ["keeper", "storekeeper"],
    ["operator", "operator"],
  ]) {
    const id = randomUUID();
    const user = await c.prisma.user.create({
      data: { id, name, email: id + "@test.invalid", role },
    });
    users[name] = user;
    await c.prisma.account.create({
      data: {
        id,
        accountId: id,
        userId: id,
        providerId: "credential",
        password: hash,
      },
    });
    const session = await auth.api.signInEmail({
      body: { email: user.email, password },
      returnHeaders: true,
    });
    cookies.set(
      name,
      session.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    );
  }
  const fixture = await Test.createTestingModule({
    imports: [WarehouseReservationsModule, WarehouseReceiptsModule],
    providers: [
      { provide: ACTIVE_MODULES, useValue: ["warehouse", "orders"] },
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
  })
    .overrideProvider(PrismaService)
    .useValue(c.prisma)
    .overrideProvider(STORAGE_CONFIG)
    .useValue({
      accessKey: "test",
      secretKey: "test",
      region: "us-east-1",
      endpoint: "http://127.0.0.1:1",
      bucket: "test",
      forcePathStyle: true,
    })
    .compile();
  const app = fixture.createNestApplication({ logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = (await app.getUrl()) + "/api/warehouse/reservations";
    return {
      ...users,
      close: () => app.close(),
      async request(method, path, expected, body, role = "admin") {
        const url = path.startsWith("/api/")
          ? (await app.getUrl()) + path
          : base + path;
        const response = await fetch(url, {
          method,
          headers: {
            "content-type": "application/json",
            cookie: cookies.get(role) ?? "",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const result = await response.json();
        if (expected === undefined) return { status: response.status, result };
        assert.equal(
          response.status,
          expected,
          method + " " + path + " " + JSON.stringify(result),
        );
        return result;
      },
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}
