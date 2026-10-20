import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { fixture, service, prisma, actor, day, date, errorCode } = env;
  test('moving a joined future revision moves its predecessor boundary both ways without gaps', async () => {
    const f = await fixture();
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const revision = await service.createRevision(
      old.id,
      {
        effectiveFrom: day(10),
        items: f.rows,
      },
      actor,
    );
    for (const offset of [20, 5]) {
      await service.updateFuture(
        revision.id,
        {
          effectiveFrom: day(offset),
          items: f.rows,
        },
        actor,
      );
      assert.equal(
        (await service.findOne(old.id)).effectiveTo,
        day(offset - 1),
      );
      assert.equal(
        (
          await service.findEffectiveNorm(
            f.position.id,
            date(offset - 1),
            'MALE',
          )
        ).id,
        old.id,
      );
      assert.equal(
        (await service.findEffectiveNorm(f.position.id, date(offset), 'MALE'))
          .id,
        revision.id,
      );
    }
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'ppe_norm', entityId: old.id, action: 'UPDATE' },
    });
    assert.ok(logs.some((log) => log.newValue === day(19)));
    assert.ok(logs.some((log) => log.newValue === day(4)));
  });

  test('new revision closes an open period and preserves all previous item IDs and values', async () => {
    const f = await fixture();
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const revision = await service.createRevision(
      old.id,
      {
        effectiveFrom: day(10),
        effectiveTo: null,
        items: [{ ...f.rows[1], quantity: 6 }],
      },
      actor,
    );
    const closed = await service.findOne(old.id);
    assert.equal(closed.effectiveTo, day(9));
    assert.deepEqual(closed.items, old.items);
    assert.equal(revision.positionId, old.positionId);
    assert.equal(revision.items.length, 1);
    assert.equal(revision.items[0].quantity, 6);
    assert.notEqual(revision.items[0].id, old.items[1].id);
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'ppe_norm', entityId: old.id, action: 'UPDATE' },
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].newValue, day(9));
    assert.equal(logs[0].userId, actor);
  });

  test('a revision cannot branch from an obsolete source and bypass intervening history', async () => {
    const f = await fixture();
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-30), effectiveTo: day(-20) },
      actor,
    );
    const middle = await service.createRevision(
      old.id,
      {
        effectiveFrom: day(5),
        effectiveTo: day(10),
        items: f.rows,
      },
      actor,
    );
    const before = await service.list(f.position.id);
    await assert.rejects(
      service.createRevision(
        old.id,
        {
          effectiveFrom: day(20),
          items: f.rows,
        },
        actor,
      ),
      errorCode('PPE_NORM_PERIOD_CONFLICT'),
    );
    assert.deepEqual(await service.list(f.position.id), before);
    const next = await service.createRevision(
      middle.id,
      {
        effectiveFrom: day(20),
        items: f.rows,
      },
      actor,
    );
    assert.equal(
      (await prisma.ppeNorm.findUniqueOrThrow({ where: { id: next.id } }))
        .previousNormId,
      middle.id,
    );
  });

  test('revision cannot backdate or overlap another norm, and a closed source stays unchanged', async () => {
    const f = await fixture();
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-10), effectiveTo: day(-1) },
      actor,
    );
    const data = { effectiveFrom: day(10), items: f.rows };
    await assert.rejects(
      service.createRevision(
        old.id,
        { ...data, effectiveFrom: day(-5) },
        actor,
      ),
      errorCode('INVALID_NORM_DATE'),
    );
    await service.createRevision(old.id, data, actor);
    await assert.rejects(
      service.createRevision(
        old.id,
        { ...data, effectiveFrom: day(20) },
        actor,
      ),
      errorCode('PPE_NORM_PERIOD_CONFLICT'),
    );
    assert.deepEqual(await service.findOne(old.id), old);
    await assert.rejects(
      service.createRevision(2147483647, data, actor),
      errorCode('PPE_NORM_NOT_FOUND'),
    );
  });
}
