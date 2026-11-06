import assert from "node:assert/strict";

export async function verifyAtomicity(c, t) {
  const { prisma, keys, source, admin, key, sources, accept, payload } = c;
  await t.test(
    "key creation and revocation are atomic with audit; source creation rolls back its internal actor",
    async () => {
      const count = await prisma.apiKey.count();
      c.setAuditFails(true);
      await assert.rejects(
        keys.create(
          source.code,
          { name: "rollback", flows: { "test.first": ["event:create"] } },
          admin.id,
        ),
      );
      assert.equal(await prisma.apiKey.count(), count);
      await assert.rejects(keys.revoke(source.code, key.id, admin.id));
      assert.equal(
        (await prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } }))
          .enabled,
        true,
      );
      const users = await prisma.user.count();
      await assert.rejects(
        sources.create(
          {
            name: "Rollback",
            systemType: "ONE_C",
            baseUrl: "http://127.0.0.1:1/",
            authorization: "Bearer secret",
          },
          admin.id,
        ),
      );
      assert.equal(await prisma.user.count(), users);
      c.setAuditFails(false);
      await keys.revoke(source.code, key.id, admin.id);
      await assert.rejects(accept(payload()));
    },
  );
}

export async function verifyAtomicSourceSettings(c, t) {
  await t.test(
    "source settings and all flows commit together or fully roll back",
    async () => {
      const { prisma, sources, admin, registry } = c;
      for (const [flowCode, permission] of [
        ["test.atomic-first", "warehouse.receipts.read"],
        ["test.atomic-second", "warehouse.receipts.map"],
      ])
        registry.registerFlow({
          ...registry.findFlow("test.first"),
          flowCode,
          actorPermissions: [permission],
        });
      const flow = (flowCode) => ({
        flowCode,
        configVersion: 1,
        config: {},
        isActive: true,
      });
      const initial = await sources.create(
        {
          name: "Atomic settings",
          systemType: "ONE_C",
          baseUrl: "http://127.0.0.1:1/",
          authorization: "Bearer original",
          flows: [flow("test.atomic-first"), flow("test.atomic-second")],
        },
        admin.id,
      );
      const snapshot = async () => ({
        ...(await prisma.integrationSource.findUniqueOrThrow({
          where: { id: initial.id },
          include: { flows: { orderBy: { flowCode: "asc" } } },
        })),
        permissions: await prisma.systemActorPermission.findMany({
          where: { sourceId: initial.id, actorUserId: initial.actorUserId },
          orderBy: { permission: "asc" },
        }),
        audit: await prisma.auditLog.findMany({
          where: { entityStringId: { startsWith: initial.id } },
          orderBy: { id: "asc" },
        }),
      });
      const before = await snapshot();
      assert.deepEqual(
        before.permissions.map((p) => p.permission),
        ["warehouse.receipts.map", "warehouse.receipts.read"],
      );
      const auditCount = await prisma.auditLog.count();
      const settings = {
        name: "Changed",
        baseUrl: "http://127.0.0.1:2/",
        authorization: "Bearer replacement",
        flows: [
          { ...flow("test.atomic-first"), isActive: false },
          { ...flow("test.atomic-second"), configVersion: 999 },
        ],
      };
      await assert.rejects(sources.update(initial.code, settings, admin.id));
      assert.deepEqual(await snapshot(), before);
      assert.equal(await prisma.auditLog.count(), auditCount);
      settings.flows[1].configVersion = 1;
      c.setAuditFails("integration_source");
      try {
        await assert.rejects(
          sources.update(initial.code, settings, admin.id),
          /audit failed/,
        );
      } finally {
        c.setAuditFails(false);
      }
      assert.deepEqual(await snapshot(), before);
      const saved = await sources.update(initial.code, settings, admin.id);
      assert.equal(saved.name, "Changed");
      assert.equal(saved.baseUrl, "http://127.0.0.1:2/");
      assert.notEqual(
        (await snapshot()).authorizationEncrypted,
        before.authorizationEncrypted,
      );
      assert.equal(
        saved.flows.find((f) => f.flowCode === "test.atomic-first").isActive,
        false,
      );
      assert.equal(
        saved.flows.find((f) => f.flowCode === "test.atomic-second").isActive,
        true,
      );
      const successful = await snapshot();
      assert.deepEqual(
        successful.permissions.map((p) => p.permission),
        ["warehouse.receipts.map"],
      );
      await assert.rejects(
        sources.update(
          initial.code,
          {
            name: "Duplicate flows",
            flows: [flow("test.atomic-first"), flow("test.atomic-first")],
          },
          admin.id,
        ),
      );
      assert.deepEqual(await snapshot(), successful);
      // Omission disables a flow while retaining its history and configuration.
      c.setAuditFails("integration_source");
      try {
        await assert.rejects(
          sources.update(initial.code, { flows: [] }, admin.id),
          /audit failed/,
        );
      } finally {
        c.setAuditFails(false);
      }
      assert.deepEqual(await snapshot(), successful);
      const subset = await sources.update(
        initial.code,
        { flows: [flow("test.atomic-first")] },
        admin.id,
      );
      assert.equal(
        subset.flows.find((f) => f.flowCode === "test.atomic-first").isActive,
        true,
      );
      assert.equal(
        subset.flows.find((f) => f.flowCode === "test.atomic-second").isActive,
        false,
      );
      const empty = await sources.update(initial.code, { flows: [] }, admin.id);
      assert.equal(empty.flows.length, 2);
      assert.ok(empty.flows.every((f) => !f.isActive));
      assert.deepEqual((await snapshot()).permissions, []);
    },
  );
}
