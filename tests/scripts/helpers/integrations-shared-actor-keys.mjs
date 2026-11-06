import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifySharedActorKeys({
  prisma,
  source,
  keys,
  machine,
  events,
  admin,
}) {
  const template = await prisma.integrationSource.findUniqueOrThrow({
    where: { id: source.id },
  });
  const createSource = () =>
    prisma.integrationSource.create({
      data: {
        id: randomUUID(),
        code: randomUUID(),
        name: "Shared actor source",
        actorUserId: source.actorUserId,
        systemType: "ONE_C",
        baseUrl: template.baseUrl,
        authorizationEncrypted: template.authorizationEncrypted,
        flows: {
          create: { flowCode: "test.first", configVersion: 1, config: {} },
        },
      },
    });
  const a = await createSource(),
    b = await createSource(),
    permissions = { "test.first": ["event:create"] };
  const keyA = await keys.create(
      a.code,
      { name: "Source A", flows: permissions },
      admin.id,
    ),
    keyB = await keys.create(
      b.code,
      { name: "Source B", flows: permissions },
      admin.id,
    );
  const wrongPurpose = await machine.create(
    source.actorUserId,
    "Other purpose",
    86400,
    { purpose: "other", sourceId: a.id },
    permissions,
  );
  const malformed = await machine.create(
    source.actorUserId,
    "Malformed metadata",
    86400,
    {},
    permissions,
  );
  await prisma.apiKey.update({
    where: { id: malformed.id },
    data: { metadata: "{" },
  });
  try {
    assert.equal(a.actorUserId, b.actorUserId);
    const listedA = await keys.list(a.code, admin.id),
      listedB = await keys.list(b.code, admin.id);
    assert.deepEqual(
      listedA.map((k) => k.id),
      [keyA.id],
    );
    assert.deepEqual(
      listedB.map((k) => k.id),
      [keyB.id],
    );
    assert.deepEqual(
      (
        await machine.list(a.actorUserId, {
          purpose: "integration",
          sourceId: a.id,
        })
      ).map((k) => k.id),
      [keyA.id],
    );
    for (const key of [...listedA, ...listedB]) {
      assert.equal("key" in key, false);
      assert.equal("metadata" in key, false);
    }
    await assert.rejects(
      keys.revoke(a.code, keyB.id, admin.id),
      (e) => e.response?.code === "MACHINE_KEY_INVALID",
    );
    await assert.rejects(
      keys.revoke(b.code, keyA.id, admin.id),
      (e) => e.response?.code === "MACHINE_KEY_INVALID",
    );
    await assert.rejects(
      keys.revoke(a.code, wrongPurpose.id, admin.id),
      (e) => e.response?.code === "MACHINE_KEY_INVALID",
    );
    await assert.rejects(
      keys.revoke(a.code, malformed.id, admin.id),
      (e) => e.response?.code === "MACHINE_KEY_INVALID",
    );
    assert.equal(
      (await prisma.apiKey.findUniqueOrThrow({ where: { id: keyB.id } }))
        .enabled,
      true,
    );
    assert.equal(
      (await prisma.apiKey.findUniqueOrThrow({ where: { id: keyA.id } }))
        .enabled,
      true,
    );
    await assert.rejects(
      events.accept(
        b.code,
        "test.first",
        {
          eventId: randomUUID(),
          objectId: "wrong-source",
          type: "UPDATED",
          version: "1",
        },
        `Bearer ${keyA.key}`,
      ),
      (e) => e.status === 401,
    );
    await keys.revoke(a.code, keyA.id, admin.id);
    await assert.rejects(
      machine.verifyBearer(`Bearer ${keyA.key}`, permissions),
      (e) => e.status === 401,
    );
    const verifiedB = await machine.verifyBearer(
      `Bearer ${keyB.key}`,
      permissions,
    );
    assert.equal(verifiedB.id, keyB.id);
    assert.equal((await keys.list(a.code, admin.id))[0].enabled, false);
    assert.equal((await keys.list(b.code, admin.id))[0].enabled, true);
  } finally {
    // Deliberate corruption belongs only to this scenario, not to later migration tests.
    await prisma.apiKey.update({
      where: { id: malformed.id },
      data: { metadata: JSON.stringify({}) },
    });
  }
}
