import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyActorPermissions(c, t) {
  const { prisma, sources, registry, admin } = c;
  const shared = "warehouse.receipts.map";
  const firstPermission = "warehouse.receipts.read";
  const secondPermission = "warehouse.receipts.integration";
  const addedPermission = "warehouse.receipts.place";
  const secondPermissions = [shared, secondPermission];
  const register = (code, permissions) =>
    registry.registerFlow({
      flowCode: code,
      name: code,
      owner: "test",
      systemTypes: ["ONE_C"],
      configVersions: [1],
      incomingActions: ["event:create"],
      actorPermissions: permissions,
      validateConfig() {},
      validateEvent() {},
      async handle() {},
    });
  const firstCode = "test.permissions-first",
    secondCode = "test.permissions-second",
    absentCode = "test.permissions-absent";
  register(firstCode, [firstPermission, shared]);
  register(secondCode, secondPermissions);
  const flow = (flowCode, isActive = true) => ({
    flowCode,
    isActive,
    configVersion: 1,
    config: {},
  });
  const source = await sources.create(
    {
      name: "Permission lifecycle",
      systemType: "ONE_C",
      baseUrl: "http://127.0.0.1:1/",
      authorization: "Bearer permission-test",
      flows: [flow(firstCode), flow(secondCode)],
    },
    admin.id,
  );
  const grants = async (sourceId = source.id) =>
    (
      await prisma.systemActorPermission.findMany({
        where: { sourceId, actorUserId: source.actorUserId },
        orderBy: { permission: "asc" },
      })
    ).map((r) => r.permission);

  await t.test("two active flows grant their union", async () => {
    assert.deepEqual(
      await grants(),
      [firstPermission, secondPermission, shared].sort(),
    );
  });
  await t.test("disabling a flow revokes its unique permission", async () => {
    await sources.configureFlow(
      source.code,
      firstCode,
      { isActive: false, configVersion: 1, config: {} },
      admin.id,
    );
    assert.deepEqual(await grants(), [secondPermission, shared].sort());
  });
  await t.test(
    "the permission shared with another active flow is retained",
    async () => {
      assert.ok((await grants()).includes(shared));
    },
  );
  const existing = await prisma.integrationSource.findUniqueOrThrow({
    where: { id: source.id },
  });
  const otherSource = await prisma.integrationSource.create({
    data: {
      id: randomUUID(),
      code: randomUUID(),
      name: "Same actor, different source",
      systemType: existing.systemType,
      baseUrl: existing.baseUrl,
      authorizationEncrypted: existing.authorizationEncrypted,
      actorUserId: source.actorUserId,
    },
  });
  await prisma.systemActorPermission.create({
    data: {
      sourceId: otherSource.id,
      actorUserId: source.actorUserId,
      permission: firstPermission,
    },
  });
  await t.test(
    "reconciliation never deletes grants of a different source sharing the actor",
    async () => {
      await prisma.systemActorPermission.create({
        data: {
          sourceId: source.id,
          actorUserId: source.actorUserId,
          permission: firstPermission,
        },
      });
      await sources.update(
        source.code,
        { flows: [flow(secondCode)] },
        admin.id,
      );
      assert.ok(!(await grants()).includes(firstPermission));
      assert.deepEqual(await grants(otherSource.id), [firstPermission]);
    },
  );
  await t.test(
    "an unavailable active handler preserves old grants while known handlers add missing ones",
    async () => {
      await prisma.integrationFlow.create({
        data: { sourceId: source.id, ...flow(absentCode) },
      });
      secondPermissions.splice(
        0,
        secondPermissions.length,
        shared,
        addedPermission,
      );
      await sources.update(
        source.code,
        { flows: [flow(secondCode), flow(absentCode)] },
        admin.id,
      );
      assert.deepEqual(
        await grants(),
        [secondPermission, shared, addedPermission].sort(),
      );
    },
  );
  await t.test(
    "when the handler returns obsolete permissions are removed",
    async () => {
      register(absentCode, []);
      await sources.update(
        source.code,
        { flows: [flow(secondCode), flow(absentCode)] },
        admin.id,
      );
      assert.deepEqual(await grants(), [shared, addedPermission].sort());
    },
  );
  await t.test(
    "an audit failure rolls back revocation and changed handler requirements are reconciled on success",
    async () => {
      secondPermissions.splice(0, secondPermissions.length, shared);
      const before = await grants();
      c.setAuditFails("integration_source");
      try {
        await assert.rejects(
          sources.update(
            source.code,
            { flows: [flow(secondCode), flow(absentCode)] },
            admin.id,
          ),
          /audit failed/,
        );
      } finally {
        c.setAuditFails(false);
      }
      assert.deepEqual(await grants(), before);
      await sources.update(
        source.code,
        { flows: [flow(secondCode), flow(absentCode)] },
        admin.id,
      );
      assert.deepEqual(await grants(), [shared]);
    },
  );
  await t.test("no active flows means no grants for this source", async () => {
    await sources.update(source.code, { flows: [] }, admin.id);
    assert.deepEqual(await grants(), []);
    assert.deepEqual(await grants(otherSource.id), [firstPermission]);
  });
}
