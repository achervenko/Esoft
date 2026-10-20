import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests({ fixture, service, prisma, actor, day }) {
  for (const { linked, adjacent } of [
    { linked: false, adjacent: false },
    { linked: false, adjacent: true },
    { linked: true, adjacent: false },
  ]) {
    test(`deleting a future norm preserves an explicitly ended predecessor (linked=${linked}, adjacent=${adjacent})`, async () => {
      const f = await fixture();
      const original = await service.create(
        {
          ...f.payload,
          effectiveFrom: day(-20),
          effectiveTo: day(adjacent ? 9 : -5),
        },
        actor,
      );
      const middle = linked
        ? await service.createRevision(
            original.id,
            { effectiveFrom: day(10), items: f.rows },
            actor,
          )
        : await service.create({ ...f.payload, effectiveFrom: day(10) }, actor);
      const last = await service.createRevision(
        middle.id,
        { effectiveFrom: day(20), items: f.rows },
        actor,
      );
      const auditsBefore = await prisma.auditLog.count({
        where: { entityType: 'ppe_norm', entityId: original.id },
      });
      await service.deleteFuture(middle.id, actor);
      assert.deepEqual(await service.findOne(original.id), original);
      assert.equal(
        (await prisma.ppeNorm.findUniqueOrThrow({ where: { id: last.id } }))
          .previousNormId,
        linked ? original.id : null,
      );
      assert.equal(
        await prisma.auditLog.count({
          where: { entityType: 'ppe_norm', entityId: original.id },
        }),
        auditsBefore,
      );
      await service.deleteFuture(last.id, actor);
      assert.deepEqual(await service.findOne(original.id), original);
    });
  }

  test('deleting the only future revision reopens the predecessor and preserves its items', async () => {
    const f = await fixture();
    const original = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const future = await service.createRevision(
      original.id,
      { effectiveFrom: day(10), items: f.rows },
      actor,
    );
    await service.deleteFuture(future.id, actor);
    const restored = await service.findOne(original.id);
    assert.equal(restored.effectiveTo, null);
    assert.deepEqual(restored.items, original.items);
    assert.equal(
      (
        await service.findEffectiveNorm(
          original.positionId,
          new Date(day(20)),
          'MALE',
        )
      ).id,
      original.id,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: 'ppe_norm',
          entityId: original.id,
          action: 'UPDATE',
          oldValue: day(9),
          newValue: 'не указано',
        },
      }),
      1,
    );
  });

  test('deleting an intermediate future revision fills the gap and repairs transition ancestry', async () => {
    const f = await fixture();
    const original = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const middle = await service.createRevision(
      original.id,
      { effectiveFrom: day(10), items: f.rows },
      actor,
    );
    const last = await service.createRevision(
      middle.id,
      { effectiveFrom: day(20), items: f.rows },
      actor,
    );
    await service.deleteFuture(middle.id, actor);
    assert.equal((await service.findOne(original.id)).effectiveTo, day(19));
    assert.equal(
      (await prisma.ppeNorm.findUniqueOrThrow({ where: { id: last.id } }))
        .previousNormId,
      original.id,
    );
    assert.equal(
      (
        await service.findEffectiveNorm(
          original.positionId,
          new Date(day(10)),
          'MALE',
        )
      ).id,
      original.id,
    );
    assert.equal(
      (
        await service.findEffectiveNorm(
          original.positionId,
          new Date(day(20)),
          'MALE',
        )
      ).id,
      last.id,
    );
    await service.deleteFuture(last.id, actor);
    assert.equal((await service.findOne(original.id)).effectiveTo, null);
  });

  test('ending an active norm preserves its items and stops future applicability', async () => {
    const f = await fixture();
    const norm = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const ended = await service.end(norm.id, { effectiveTo: day(0) }, actor);
    assert.deepEqual(ended.items, norm.items);
    assert.equal(ended.effectiveTo, day(0));
    assert.equal(
      await service.findEffectiveNorm(
        norm.positionId,
        new Date(day(1)),
        'MALE',
      ),
      null,
    );
    await assert.rejects(service.deleteFuture(norm.id, actor));
    await assert.rejects(service.end(norm.id, { effectiveTo: day(-1) }, actor));
    await assert.rejects(service.end(norm.id, { effectiveTo: day(1) }, actor));
    assert.deepEqual(await service.findOne(norm.id), ended);
  });
  test('only future norms can be deleted; historical norms cannot be ended or deleted', async () => {
    const f = await fixture();
    const future = await service.create(f.payload, actor);
    await assert.rejects(
      service.end(future.id, { effectiveTo: day(20) }, actor),
    );
    await service.deleteFuture(future.id, actor);
    assert.equal(
      await prisma.ppeNormItem.count({ where: { normId: future.id } }),
      0,
    );
    await assert.rejects(service.findOne(future.id));
    const historical = await service.create(
      { ...f.payload, effectiveFrom: day(-10), effectiveTo: day(-1) },
      actor,
    );
    await assert.rejects(
      service.end(historical.id, { effectiveTo: day(0) }, actor),
    );
    await assert.rejects(service.deleteFuture(historical.id, actor));
    assert.deepEqual(await service.findOne(historical.id), historical);
  });
}
