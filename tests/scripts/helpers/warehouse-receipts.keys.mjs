import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";

export async function receiptsKeys(c, t) {
  const createSource = (name) =>
    c.coreSources.create(
      {
        name,
        systemType: "ONE_C",
        baseUrl: "http://127.0.0.1:1/",
        authorization: "Bearer outbound-only",
        flows: [
          {
            flowCode: "warehouse.receipts",
            configVersion: 1,
            config: {},
            isActive: true,
          },
        ],
      },
      c.admin.id,
    );
  const source = await createSource("Key tests");
  const otherSource = await createSource("Other key source");
  const sourceSystem = source.code,
    sourceId = source.id;
  const actor = await c.prisma.user.findUniqueOrThrow({
    where: { id: source.actorUserId },
  });
  const configure = (code, isActive = true) =>
    c.coreSources.update(code, { isActive }, c.admin.id);
  const create = (source) =>
    c.coreKeys.create(
      source,
      {
        flows: { "warehouse.receipts": ["event:create"] },
        name: "1C test key",
      },
      c.admin.id,
    );
  const event = {
    eventId: randomUUID(),
    objectId: "keys-document",
    type: "RECEIPT_CHANGED",
    version: "1",
  };
  const enqueue = (key, source = sourceSystem) =>
    c.coreEvents.accept(
      source,
      "warehouse.receipts",
      event,
      key ? `Bearer ${key}` : undefined,
    );

  await t.test(
    "real Better Auth keys: source scope, owner, permissions and no session",
    async () => {
      const first = await create(sourceSystem),
        other = await create(otherSource.code);
      await assert.rejects(enqueue(), code("MACHINE_KEY_INVALID"));
      await assert.rejects(
        enqueue("outbound-only"),
        code("MACHINE_KEY_INVALID"),
      );
      await assert.rejects(
        enqueue(other.key),
        code("INTEGRATION_SOURCE_UNAUTHORIZED"),
      );
      await assert.rejects(
        enqueue(first.key, otherSource.code),
        code("INTEGRATION_SOURCE_UNAUTHORIZED"),
      );
      const wrongOwner = await c.machineKeys.create(
        c.admin.id,
        "wrong owner",
        86400,
        {
          purpose: "integration",
          sourceId: (
            await c.prisma.integrationSource.findUniqueOrThrow({
              where: { code: sourceSystem },
            })
          ).id,
        },
        { "warehouse.receipts": ["event:create"] },
      );
      await assert.rejects(
        enqueue(wrongOwner.key),
        code("INTEGRATION_SOURCE_UNAUTHORIZED"),
      );
      const noPermission = await c.machineKeys.create(
        actor.id,
        "no permissions",
        86400,
        {
          purpose: "integration",
          sourceId: (
            await c.prisma.integrationSource.findUniqueOrThrow({
              where: { code: sourceSystem },
            })
          ).id,
        },
        {},
      );
      await assert.rejects(
        enqueue(noPermission.key),
        code("MACHINE_KEY_INVALID"),
      );
      assert.equal(
        await c.prisma.integrationEvent.count({
          where: { sourceId, flowCode: "warehouse.receipts" },
        }),
        0,
      );
      await enqueue(first.key);
      await enqueue(first.key);
      assert.equal(
        await c.prisma.integrationEvent.count({
          where: { sourceId, flowCode: "warehouse.receipts" },
        }),
        1,
      );
      const session = await c.machineAuth.api.getSession({
        headers: new Headers({
          authorization: `Bearer ${first.key}`,
          "x-api-key": first.key,
        }),
      });
      assert.equal(session, null);
      const listed = await c.coreKeys.list(sourceSystem, c.admin.id);
      assert.ok(listed.some((key) => key.id === first.id));
      assert.equal(
        listed.some((key) => key.id === other.id),
        false,
      );
      assert.ok(listed.every((key) => !("key" in key) && !("metadata" in key)));
      for (const path of [
        "/api-key/create",
        "/api-key/update",
        "/api-key/delete",
        "/api-key/list",
        "/api-key/get",
      ]) {
        const response = await c.machineAuth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            method:
              path.endsWith("/list") || path.endsWith("/get") ? "GET" : "POST",
            headers: { "content-type": "application/json" },
            ...(path.endsWith("/list") || path.endsWith("/get")
              ? {}
              : { body: "{}" }),
          }),
        );
        assert.equal(response.status, 404);
      }
    },
  );
  await t.test(
    "rotation, expiration, rate limit and source/actor revocation",
    async () => {
      const old = await create(sourceSystem),
        replacement = await create(sourceSystem);
      await c.coreKeys.revoke(sourceSystem, old.id, c.admin.id);
      await assert.rejects(enqueue(old.key), code("MACHINE_KEY_INVALID"));
      await enqueue(replacement.key);
      await configure(sourceSystem, false);
      await assert.rejects(
        enqueue(replacement.key),
        code("INTEGRATION_SOURCE_UNAUTHORIZED"),
      );
      await assert.rejects(
        c.coreSources.update(
          sourceSystem,
          { actorUserId: c.admin.id },
          c.admin.id,
        ),
        code("INTEGRATION_INVALID"),
      );
      await configure(sourceSystem);
      await enqueue(replacement.key);
      for (const data of [
        { banned: true },
        { banned: false, role: "storekeeper" },
      ]) {
        await c.prisma.user.update({ where: { id: actor.id }, data });
        await assert.rejects(enqueue(replacement.key), code("FORBIDDEN"));
        assert.ok(
          (await c.coreKeys.list(sourceSystem, c.admin.id)).some(
            (key) => key.id === replacement.id,
          ),
        );
        await assert.rejects(create(sourceSystem), code("FORBIDDEN"));
      }
      await c.coreKeys.revoke(sourceSystem, replacement.id, c.admin.id);
      await c.prisma.user.update({
        where: { id: actor.id },
        data: { banned: false, role: "system:integration" },
      });
      const expired = await create(sourceSystem);
      await c.prisma.apiKey.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await assert.rejects(enqueue(expired.key), code("MACHINE_KEY_INVALID"));
      const limited = await create(sourceSystem);
      await c.machineAuth.api.updateApiKey({
        body: {
          configId: "machine",
          keyId: limited.id,
          userId: actor.id,
          rateLimitMax: 1,
        },
      });
      await enqueue(limited.key);
      await assert.rejects(
        enqueue(limited.key),
        code("MACHINE_KEY_RATE_LIMITED"),
      );
    },
  );
  await t.test(
    "key administration validates rights, scope and failed audit",
    async () => {
      await assert.rejects(
        c.coreKeys.create(
          sourceSystem,
          { flows: { "warehouse.receipts": ["event:create"] }, name: "denied" },
          c.keeper.id,
        ),
        code("FORBIDDEN"),
      );
      await assert.rejects(
        c.coreKeys.create(
          sourceSystem,
          {
            flows: { "warehouse.receipts": ["event:create"] },
            name: "scope injection",
            metadata: { sourceSystem: "other" },
          },
          c.admin.id,
        ),
        code("INTEGRATION_INVALID"),
      );
      await assert.rejects(
        c.coreKeys.create(
          sourceSystem,
          {
            flows: { "warehouse.receipts": ["event:create"] },
            name: "invalid",
            expiresIn: 0,
          },
          c.admin.id,
        ),
        code("INTEGRATION_INVALID"),
      );
      const foreign = await create(otherSource.code);
      await assert.rejects(
        c.coreKeys.revoke(sourceSystem, foreign.id, c.admin.id),
        code("MACHINE_KEY_INVALID"),
      );
      c.failAudit(true);
      try {
        await assert.rejects(
          c.coreKeys.create(
            sourceSystem,
            {
              flows: { "warehouse.receipts": ["event:create"] },
              name: "audit failure",
            },
            c.admin.id,
          ),
          /audit failed/,
        );
      } finally {
        c.failAudit(false);
      }
      const failed = await c.prisma.apiKey.findFirst({
        where: { referenceId: actor.id, name: "audit failure" },
      });
      assert.equal(failed, null);
    },
  );
  await configure(sourceSystem, false);
  await configure(otherSource.code, false);
}
