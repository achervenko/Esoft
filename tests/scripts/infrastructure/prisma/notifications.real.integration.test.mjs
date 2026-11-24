import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { createIntegrationsCoreContext } from "./integrations/integrations-core-context.mjs";

const require = createRequire(import.meta.url);
const load = (path) => require("../../../../backend/dist/src/" + path);

test(
  "notification core on isolated PostgreSQL",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 120_000,
  },
  async (t) => {
    const context = await createIntegrationsCoreContext();
    const { prisma } = context;
    const { NotificationsService } = load(
      "notifications/notifications.service.js",
    );
    const service = new NotificationsService(prisma);
    let app;
    try {
      const users = await Promise.all(
        ["operator", "storekeeper", "auditor"].map(async (role) => {
          const id = randomUUID();
          return prisma.user.create({
            data: { id, name: role, email: id + "@test.invalid", role },
          });
        }),
      );
      const [first, second, stranger] = users;
      const make = (patch = {}) => ({
        eventKey: randomUUID(),
        type: "test",
        title: "Test notification",
        body: "Notification text",
        targetPath: "#/orders",
        occurredAt: new Date("2026-11-21T12:00:00Z"),
        recipientIds: [first.id, second.id],
        ...patch,
      });

      await t.test(
        "setAction acquires the lock to open and close an action",
        async () => {
          const user = await prisma.user.create({
            data: {
              id: randomUUID(),
              name: "Action recipient",
              email: randomUUID() + "@test.invalid",
              role: "storekeeper",
            },
          });
          const key = randomUUID();
          const { eventKey: _eventKey, ...input } = make({
            recipientIds: [user.id],
          });
          const set = (value) =>
            prisma.$transaction((tx) => service.setAction(tx, key, value));
          const history = () =>
            prisma.notification.findMany({ where: { actionKey: key } });

          await Promise.all([set(input), set(input)]);
          const [opened] = await history();
          assert.equal((await history()).length, 1);
          assert.equal(opened.resolvedAt, null);
          assert.equal(
            (await service.list(user.id, { filter: "unread" })).items[0].id,
            opened.id,
          );

          await set(null);
          const [closed] = await history();
          assert.equal(closed.id, opened.id);
          assert.ok(closed.resolvedAt);
          assert.equal(
            (await service.list(user.id, { filter: "unread" })).items.length,
            0,
          );
        },
      );

      await t.test(
        "creates one message atomically with the whole recipient set",
        async () => {
          const input = make();
          const message = await service.create(input);
          const rows = await prisma.notificationRecipient.findMany({
            where: { notificationId: message.id },
          });
          assert.deepEqual(
            rows.map((row) => row.userId).sort(),
            [...input.recipientIds].sort(),
          );
          assert.ok(
            rows.every(
              (row) => row.readAt === null && row.deliveredAt === null,
            ),
          );
          const invalid = make({ recipientIds: [first.id, randomUUID()] });
          await assert.rejects(service.create(invalid));
          assert.equal(
            await prisma.notification.count({
              where: { eventKey: invalid.eventKey },
            }),
            0,
          );
        },
      );

      await t.test(
        "uses the supplied transaction and rolls back the complete message",
        async () => {
          const input = make();
          let id;
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              ({ id } = await service.create(input, tx));
              assert.equal(
                await tx.notificationRecipient.count({
                  where: { notificationId: id },
                }),
                2,
              );
              assert.equal(
                await prisma.notification.count({
                  where: { eventKey: input.eventKey },
                }),
                0,
              );
              throw Error("rollback");
            }),
            /rollback/,
          );
          assert.equal(
            await prisma.notification.count({
              where: { eventKey: input.eventKey },
            }),
            0,
          );
          assert.equal(
            await prisma.notificationRecipient.count({
              where: { notificationId: id },
            }),
            0,
          );

          const committed = await prisma.$transaction(
            (tx) => service.create(input, tx),
            { isolationLevel: "ReadCommitted" },
          );
          assert.equal(
            await prisma.notificationRecipient.count({
              where: { notificationId: committed.id },
            }),
            2,
          );
        },
      );

      for (const isolationLevel of ["RepeatableRead", "Serializable"]) {
        await t.test(
          `rejects external ${isolationLevel} before writing`,
          async () => {
            const input = make();
            const before = await prisma.notificationRecipient.count();
            await prisma.$transaction(
              async (tx) => {
                await assert.rejects(
                  service.create(input, tx),
                  (error) =>
                    error.getStatus() === 400 &&
                    error.getResponse().code ===
                      "NOTIFICATION_ISOLATION_REQUIRED" &&
                    error.message.includes("READ COMMITTED"),
                );
                assert.equal(
                  await tx.notification.count({
                    where: { eventKey: input.eventKey },
                  }),
                  0,
                );
                assert.equal(await tx.notificationRecipient.count(), before);
              },
              { isolationLevel },
            );
            assert.equal(
              await prisma.notification.count({
                where: { eventKey: input.eventKey },
              }),
              0,
            );
            assert.equal(await prisma.notificationRecipient.count(), before);
          },
        );
      }

      await t.test(
        "concurrent replays are identical and conflicting requests do not overwrite",
        async () => {
          const input = make();
          const copies = await Promise.all(
            Array.from({ length: 6 }, (_, index) =>
              index % 2 === 0
                ? service.create(input)
                : prisma.$transaction((tx) => service.create(input, tx), {
                    isolationLevel: "ReadCommitted",
                  }),
            ),
          );
          assert.equal(new Set(copies.map(({ id }) => id)).size, 1);
          const message = copies[0];
          assert.deepEqual(
            await service.create({
              ...input,
              recipientIds: [second.id, first.id, first.id],
            }),
            message,
          );
          for (const patch of [
            { type: "different" },
            { title: "another" },
            { body: "different" },
            { targetPath: null },
            { occurredAt: new Date(+input.occurredAt + 1) },
            { recipientIds: [stranger.id] },
          ]) {
            await assert.rejects(
              service.create({ ...input, ...patch }),
              (error) =>
                error.getResponse().code === "NOTIFICATION_EVENT_CONFLICT",
            );
          }
          assert.equal(
            await prisma.notificationRecipient.count({
              where: { notificationId: message.id },
            }),
            2,
          );
          assert.deepEqual(await service.create(input), message);
          const race = make();
          const competing = await Promise.allSettled([
            service.create(race),
            service.create({ ...race, body: "competing" }),
          ]);
          assert.equal(
            competing.filter(({ status }) => status === "fulfilled").length,
            1,
          );
          assert.equal(
            competing
              .find(({ status }) => status === "rejected")
              .reason.getStatus(),
            409,
          );
        },
      );

      await t.test(
        "uses authenticated HTTP, isolates accounts and preserves read timestamps",
        async () => {
          const { Test } = require("@nestjs/testing");
          const { APP_GUARD, Reflector } = require("@nestjs/core");
          const { AuthGuard } = require("@thallesp/nestjs-better-auth");
          const { betterAuth } = require("better-auth");
          const { prismaAdapter } = require("better-auth/adapters/prisma");
          const { hashPassword } = require("better-auth/crypto");
          const { admin: adminPlugin } = require("better-auth/plugins");
          const { NotificationsModule } = load(
            "notifications/notifications.module.js",
          );
          const { PrismaService } = load("prisma/prisma.service.js");
          const { ACTIVE_MODULES } = load("config/active-modules.module.js");
          const { PermissionsGuard, AUTHENTICATE_REQUEST } = load(
            "auth/permissions.guard.js",
          );
          const auth = betterAuth({
            database: prismaAdapter(prisma, { provider: "postgresql" }),
            secret: "isolated-notifications-test-only-secret",
            baseURL: "http://localhost:3000",
            emailAndPassword: { enabled: true, disableSignUp: true },
            plugins: [adminPlugin()],
            logger: { disabled: true },
          });
          const password = "Isolated-notifications-Test123!";
          const hash = await hashPassword(password);
          for (const user of users)
            await prisma.account.create({
              data: {
                id: randomUUID(),
                accountId: user.id,
                userId: user.id,
                providerId: "credential",
                password: hash,
              },
            });
          const signIn = async (user) => {
            const { headers } = await auth.api.signInEmail({
              body: { email: user.email, password },
              returnHeaders: true,
            });
            return headers
              .getSetCookie()
              .map((value) => value.split(";")[0])
              .join("; ");
          };
          const fixture = await Test.createTestingModule({
            imports: [NotificationsModule],
            providers: [
              { provide: ACTIVE_MODULES, useValue: ["equipment", "warehouse"] },
              {
                provide: AUTHENTICATE_REQUEST,
                inject: [Reflector],
                useFactory: (reflector) => {
                  const guard = new AuthGuard(reflector, { auth });
                  return (context) => guard.canActivate(context);
                },
              },
              { provide: APP_GUARD, useClass: PermissionsGuard },
            ],
          })
            .overrideProvider(PrismaService)
            .useValue(prisma)
            .compile();
          app = fixture.createNestApplication({ logger: false });
          await app.listen(0, "127.0.0.1");
          const url = (await app.getUrl()) + "/api/notifications";
          const request = async (
            path,
            cookie,
            method = "GET",
            expected = 200,
          ) => {
            const response = await fetch(url + path, {
              method,
              headers: cookie ? { cookie } : {},
            });
            const result = await response.json();
            assert.equal(response.status, expected, JSON.stringify(result));
            return result;
          };
          const firstSession = await signIn(first);
          const secondSession = await signIn(second);
          const strangerSession = await signIn(stranger);
          const message = await service.create(make());
          await request("", null, "GET", 401);
          assert.deepEqual(await request("", strangerSession), {
            items: [],
            nextCursor: null,
          });
          await request("?cursor=" + message.id, strangerSession, "GET", 404);
          await request(
            "/" + message.id + "/read",
            strangerSession,
            "PATCH",
            404,
          );
          assert.deepEqual(
            await request("/read-all", strangerSession, "PATCH"),
            { updated: 0 },
          );
          const firstPage = await request(
            "?filter=unread&limit=2",
            firstSession,
          );
          const secondPage = await request(
            "?filter=unread&limit=2&cursor=" + firstPage.nextCursor,
            firstSession,
          );
          const thirdPage = await request(
            "?filter=unread&limit=2&cursor=" + secondPage.nextCursor,
            firstSession,
          );
          const paged = [
            ...firstPage.items,
            ...secondPage.items,
            ...thirdPage.items,
          ];
          assert.equal(paged.length, 5);
          assert.equal(new Set(paged.map(({ id }) => id)).size, paged.length);
          assert.deepEqual(
            paged.map(({ id }) => id),
            paged
              .map(({ id }) => id)
              .sort()
              .reverse(),
          );
          assert.equal(thirdPage.nextCursor, null);
          assert.ok(
            paged.every(
              ({ readAt, deliveredAt }) =>
                readAt === null && deliveredAt === null,
            ),
          );
          assert.deepEqual(
            await request("/unread-count", await signIn(first)),
            { count: 5 },
          );
          const results = await Promise.all(
            Array.from({ length: 5 }, () =>
              request("/" + message.id + "/read", firstSession, "PATCH"),
            ),
          );
          assert.ok(results[0].readAt);
          assert.equal(results[0].readAt, results[0].deliveredAt);
          for (const result of results) assert.deepEqual(result, results[0]);
          assert.equal(
            (await request("/unread-count", secondSession)).count,
            5,
          );
          assert.deepEqual(await request("/read-all", firstSession, "PATCH"), {
            updated: 4,
          });
          assert.deepEqual(await request("/read-all", firstSession, "PATCH"), {
            updated: 0,
          });
          assert.deepEqual(await request("/unread-count", firstSession), {
            count: 0,
          });
          const { items } = await request("", firstSession);
          assert.equal(items.length, 5);
          assert.ok(
            items.every(({ deliveredAt, readAt }) => deliveredAt && readAt),
          );
          assert.equal(
            items.find(({ id }) => id === message.id).readAt,
            results[0].readAt,
          );
          assert.deepEqual(await request("/unread-count", secondSession), {
            count: 5,
          });
          await request("/stream", null, "GET", 401);
          const stop = new AbortController();
          const signal = AbortSignal.any([
            stop.signal,
            AbortSignal.timeout(12000),
          ]);
          const stream = async (cookie) => {
            const response = await fetch(url + "/stream", {
              headers: { cookie },
              signal,
            });
            assert.equal(response.status, 200);
            assert.match(
              response.headers.get("content-type"),
              /text\/event-stream/,
            );
            const reader = response.body
              .pipeThrough(new TextDecoderStream())
              .getReader();
            let buffer = "";
            return async () => {
              for (;;) {
                const boundary = buffer.indexOf("\n\n");
                if (boundary >= 0) {
                  const event = buffer.slice(0, boundary);
                  buffer = buffer.slice(boundary + 2);
                  if (event.includes("event: notifications-changed")) return;
                  continue;
                }
                const { done, value } = await reader.read();
                assert.equal(
                  done,
                  false,
                  "SSE stream ended before invalidation",
                );
                buffer += value;
              }
            };
          };
          try {
            const [nextFirst, nextSecond] = await Promise.all([
              stream(firstSession),
              stream(secondSession),
            ]);
            await Promise.all([nextFirst(), nextSecond()]);
            const key = randomUUID();
            const { eventKey: _eventKey, ...input } = make();
            const set = (value) =>
              prisma.$transaction((tx) => service.setAction(tx, key, value));
            await set(input);
            await Promise.all([nextFirst(), nextSecond()]);
            const change = await prisma.notification.findFirstOrThrow({
              where: { actionKey: key },
            });
            const secondRevision = await service.feedRevision(second.id);
            await request("/" + change.id + "/read", firstSession, "PATCH");
            await nextFirst();
            assert.equal(await service.feedRevision(second.id), secondRevision);
            await set(null);
            await nextSecond();
            assert.equal(
              (await request("?filter=unread", secondSession)).items.some(
                ({ id }) => id === change.id,
              ),
              false,
            );
          } finally {
            stop.abort();
          }
        },
      );
    } finally {
      try {
        await app?.close();
      } finally {
        await context.close();
      }
    }
  },
);
