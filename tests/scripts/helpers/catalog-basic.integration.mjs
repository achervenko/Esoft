import assert from "node:assert/strict";
export async function verifyCatalogBasic({ prisma, actor, service, create }) {
  const first = await create("CAT-1", { comment: " Для редуктора " });
  assert.equal(typeof first.id, "string");
  assert.equal(first.comment, "Для редуктора");
  assert.equal(first.isActive, true);
  assert.equal(Object.hasOwn(first, "externalId"), false);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.deepEqual(await service.findOne(first.id), first);
  const updated = await service.update(
    first.id,
    { name: "Новое имя", comment: null, unit: "м" },
    actor.id,
  );
  assert.equal(updated.article, "CAT-1");
  assert.equal(updated.comment, null);
  assert.equal(updated.unit, "м");
  assert.equal(updated.id, first.id);
  const second = await create("CAT-2");
  assert.equal(
    (await service.setStatus(first.id, { isActive: false }, actor.id)).isActive,
    false,
  );
  assert.equal((await service.findOne(first.id)).isActive, false);
  const inactive = await service.list({ isActive: "false" });
  assert.equal(inactive.total, 1);
  assert.deepEqual(
    inactive.items.map((item) => item.id),
    [first.id],
  );
  assert.ok(
    (await service.list({ isActive: "true" })).items.every(
      (item) => item.id !== first.id,
    ),
  );
  await service.setStatus(first.id, { isActive: true }, actor.id);

  await service.update(first.id, { comment: "Used item" }, actor.id);
  const huge = await prisma.warehouseItem.create({
    data: {
      id: 9007199254740993n,
      article: "CAT-HUGE",
      name: "Large ID",
      unit: "шт",
    },
  });
  assert.equal(
    (await service.findOne(huge.id.toString())).id,
    "9007199254740993",
  );
  assert.equal(
    (
      await service.update(
        huge.id.toString(),
        { comment: "Exact ID" },
        actor.id,
      )
    ).id,
    "9007199254740993",
  );
  assert.equal(
    (
      await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "warehouse_item",
          entityStringId: huge.id.toString(),
        },
      })
    ).entityId,
    null,
  );

  const literal = await create("CAT-%_literal", { name: "Literal search" });
  assert.deepEqual(
    (await service.list({ q: "%_" })).items.map((item) => item.id),
    [literal.id],
  );
  assert.deepEqual(
    (await service.list({ q: "пОдШиПнИк" })).items.map((item) => item.id),
    [second.id],
  );
  assert.deepEqual(
    (await service.list({ q: "used item" })).items.map((item) => item.id),
    [first.id],
  );
  const page = await service.list({ q: "CAT-", limit: "1", offset: "1" });
  assert.equal(page.items.length, 1);
  assert.equal(page.total, 4);
  assert.deepEqual(
    page.items,
    (await service.list({ q: "CAT-" })).items.slice(1, 2),
  );
}
