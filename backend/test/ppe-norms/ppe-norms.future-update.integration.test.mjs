import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { fixture, service, prisma, actor, day, errorCode } = env;
  test('future edits cannot reorder the revision chain and leave all boundaries unchanged on conflict', async () => {
    const f = await fixture();
    const first = await service.create(
      { ...f.payload, effectiveFrom: day(5) },
      actor,
    );
    const middle = await service.createRevision(
      first.id,
      {
        effectiveFrom: day(10),
        items: f.rows,
      },
      actor,
    );
    const last = await service.createRevision(
      middle.id,
      {
        effectiveFrom: day(20),
        items: f.rows,
      },
      actor,
    );
    const before = await service.list(f.position.id);
    for (const offset of [4, 21]) {
      await assert.rejects(
        service.updateFuture(
          middle.id,
          {
            effectiveFrom: day(offset),
            effectiveTo: day(offset + 1),
            items: f.rows,
          },
          actor,
        ),
        errorCode('PPE_NORM_PERIOD_CONFLICT'),
      );
      assert.deepEqual(await service.list(f.position.id), before);
    }
    assert.equal(
      (await prisma.ppeNorm.findUniqueOrThrow({ where: { id: last.id } }))
        .previousNormId,
      middle.id,
    );
  });

  test('future edit preserves retained IDs, replaces full composition, and audits changed fields', async () => {
    const f = await fixture();
    const norm = await service.create(f.payload, actor);
    const updated = await service.updateFuture(
      norm.id,
      {
        effectiveFrom: day(11),
        effectiveTo: day(30),
        items: [
          { ...f.rows[0], quantity: 2 },
          { ...f.rows[1], ppeItemId: f.items[2].id },
        ],
      },
      actor,
    );
    assert.equal(updated.items.length, 2);
    assert.equal(updated.items[0].id, norm.items[0].id);
    assert.equal(updated.items[0].quantity, 2);
    assert.ok(updated.items.some((item) => item.ppeItemId === f.items[2].id));
    assert.equal(
      await prisma.ppeNormItem.count({ where: { id: norm.items[1].id } }),
      0,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: 'ppe_norm_item',
          entityId: norm.items[1].id,
          action: 'DELETE',
        },
      }),
      8,
    );
    const logCount = await prisma.auditLog.count();
    const unchanged = await service.updateFuture(
      norm.id,
      {
        effectiveFrom: day(11),
        effectiveTo: day(30),
        items: updated.items.map(
          ({ ppeItemId, quantity, periodCount, periodUnit }) => ({
            ppeItemId,
            quantity,
            periodCount,
            periodUnit,
          }),
        ),
      },
      actor,
    );
    assert.deepEqual(unchanged, updated);
    assert.equal(await prisma.auditLog.count(), logCount);
  });
}
