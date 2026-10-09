import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';

export function registerTests(env) {
  const { fixture, service, prisma, actor, day, counts, errorCode } = env;
  test('database forbids duplicate PPE items within a norm but allows them in different revisions', async () => {
    const f = await fixture();
    const first = await service.create(
      { ...f.payload, effectiveTo: day(10) },
      actor,
    );
    const next = await service.create(
      { ...f.payload, effectiveFrom: day(11) },
      actor,
    );
    assert.equal(next.items.length, 2);
    const client = new pg.Client({ connectionString: env.testUrl.toString() });
    const uniqueViolation = (error) => {
      assert.equal(error.code, '23505');
      assert.equal(error.constraint, 'uq_ppe_norm_items_norm_ppe_item');
      return true;
    };
    try {
      await client.connect();
      await assert.rejects(
        client.query(
          `INSERT INTO ppe_norm_items
            (norm_id, ppe_item_id, ppe_name_snapshot, ppe_unit_snapshot,
             ppe_item_type_snapshot, quantity, period_count, period_unit, calculation_mode)
           SELECT norm_id, ppe_item_id, ppe_name_snapshot, ppe_unit_snapshot,
             ppe_item_type_snapshot, quantity, period_count, period_unit, calculation_mode
           FROM ppe_norm_items WHERE id = $1`,
          [first.items[0].id],
        ),
        uniqueViolation,
      );
      await assert.rejects(
        client.query(
          'UPDATE ppe_norm_items SET ppe_item_id = $1 WHERE id = $2',
          [f.items[0].id, first.items[1].id],
        ),
        uniqueViolation,
      );
      assert.deepEqual(await counts(f.position.id), { norms: 2, items: 4 });
    } finally {
      await client.end();
    }
  });

  test('creates all items and normalized DTO; field audit uses real actor and module', async () => {
    const f = await fixture();
    const norm = await service.create(f.payload, actor);
    assert.equal(norm.position, f.position.name);
    assert.equal(norm.effectiveFrom, day(10));
    assert.equal(norm.effectiveTo, null);
    assert.equal(norm.items.length, 2);
    assert.equal(norm.items[0].quantity, 1.125);
    assert.equal(norm.items[0].periodUnit, 'MONTH');
    assert.equal(norm.items[1].quantity, 12);
    assert.equal(norm.items[1].periodUnit, 'YEAR');
    assert.equal('normId' in norm.items[0], false);
    assert.equal(typeof norm.position, 'string');
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'ppe_norm', entityId: norm.id },
          {
            entityType: 'ppe_norm_item',
            entityId: { in: norm.items.map((row) => row.id) },
          },
        ],
      },
    });
    assert.equal(logs.length, 24);
    assert.ok(
      logs.every(
        (log) =>
          log.userId === actor &&
          log.module === 'PPE' &&
          log.action === 'CREATE',
      ),
    );
    assert.ok(logs.some((log) => log.newValue === '1.125'));
    assert.ok(logs.some((log) => log.newValue === f.position.name));
  });

  test('rejects unknown/missing/inactive positions and PPE before mutation', async () => {
    const f = await fixture();
    await assert.rejects(
      service.create({ ...f.payload, positionId: 2147483647 }, actor),
      errorCode('POSITION_NOT_FOUND'),
    );
    await prisma.position.update({
      where: { id: f.position.id },
      data: { isActive: false },
    });
    await assert.rejects(
      service.create(f.payload, actor),
      errorCode('POSITION_INACTIVE'),
    );
    await prisma.position.update({
      where: { id: f.position.id },
      data: { isActive: true },
    });
    await assert.rejects(
      service.create(
        { ...f.payload, items: [{ ...f.rows[0], ppeItemId: 2147483647 }] },
        actor,
      ),
      errorCode('PPE_ITEM_NOT_FOUND'),
    );
    await prisma.ppeItem.update({
      where: { id: f.items[0].id },
      data: { isActive: false },
    });
    await assert.rejects(
      service.create(f.payload, actor),
      errorCode('PPE_ITEM_INACTIVE'),
    );
    assert.deepEqual(await counts(f.position.id), { norms: 0, items: 0 });
  });

  test('closed and open overlaps include shared boundary dates; adjacent periods are allowed', async () => {
    const f = await fixture();
    await service.create(
      { ...f.payload, effectiveFrom: day(10), effectiveTo: day(20) },
      actor,
    );
    for (const [from, to] of [
      [9, 10],
      [20, 30],
      [11, 19],
      [9, 21],
      [15, null],
    ]) {
      await assert.rejects(
        service.create(
          {
            ...f.payload,
            effectiveFrom: day(from),
            effectiveTo: to === null ? null : day(to),
          },
          actor,
        ),
        errorCode('PPE_NORM_PERIOD_CONFLICT'),
      );
    }
    await service.create({ ...f.payload, effectiveFrom: day(21) }, actor);
    await service.create(
      { ...f.payload, effectiveFrom: day(1), effectiveTo: day(9) },
      actor,
    );
    await assert.rejects(
      service.create({ ...f.payload, effectiveFrom: day(30) }, actor),
      errorCode('PPE_NORM_PERIOD_CONFLICT'),
    );
    assert.equal((await counts(f.position.id)).norms, 3);
  });
}
