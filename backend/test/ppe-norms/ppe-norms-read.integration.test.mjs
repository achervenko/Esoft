import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { fixture, service, prisma, actor, day, date, errorCode } = env;
  test('reads historical, future and inactive references; effective dates are inclusive', async () => {
    const f = await fixture();
    const history = await service.create(
      { ...f.payload, effectiveFrom: day(-20), effectiveTo: day(-1) },
      actor,
    );
    const current = await service.create(
      { ...f.payload, effectiveFrom: day(0), effectiveTo: day(5) },
      actor,
    );
    const future = await service.create(
      { ...f.payload, effectiveFrom: day(10) },
      actor,
    );
    await prisma.position.update({
      where: { id: f.position.id },
      data: { isActive: false },
    });
    await prisma.ppeItem.update({
      where: { id: f.items[0].id },
      data: { isActive: false },
    });
    assert.equal((await service.list(f.position.id)).length, 3);
    assert.equal((await service.findOne(history.id)).items[0].isActive, false);
    for (const offset of [0, 5])
      assert.equal(
        (await service.findEffectiveNorm(f.position.id, date(offset))).id,
        current.id,
      );
    assert.equal(
      (await service.findEffectiveNorm(f.position.id, date(-20))).id,
      history.id,
    );
    assert.equal(
      (await service.findEffectiveNorm(f.position.id, date(10))).id,
      future.id,
    );
    assert.equal(await service.findEffectiveNorm(f.position.id, date(6)), null);
    assert.equal(
      (await service.findEffectiveNorm(f.position.id)).id,
      current.id,
    );
    await assert.rejects(
      service.findOne(2147483647),
      errorCode('PPE_NORM_NOT_FOUND'),
    );
    await assert.rejects(
      service.findEffectiveNorm(2147483647),
      errorCode('POSITION_NOT_FOUND'),
    );
  });
}
