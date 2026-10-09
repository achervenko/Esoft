import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { fixture, service, prisma, actor, day, date, errorCode } = env;
  test('active/history norms are locked; future norm cannot be moved to today or into overlap', async () => {
    const f = await fixture();
    const historical = await service.create(
      { ...f.payload, effectiveFrom: day(-10), effectiveTo: day(-1) },
      actor,
    );
    const active = await service.create(
      { ...f.payload, effectiveFrom: day(0), effectiveTo: day(5) },
      actor,
    );
    const future = await service.create(f.payload, actor);
    const edit = { effectiveFrom: day(11), items: f.rows };
    for (const norm of [historical, active])
      await assert.rejects(
        service.updateFuture(norm.id, edit, actor),
        errorCode('PPE_NORM_LOCKED'),
      );
    await assert.rejects(
      service.updateFuture(
        future.id,
        { ...edit, effectiveFrom: day(0) },
        actor,
      ),
      errorCode('PPE_NORM_LOCKED'),
    );
    await assert.rejects(
      service.updateFuture(
        future.id,
        { ...edit, effectiveFrom: day(5) },
        actor,
      ),
      errorCode('PPE_NORM_PERIOD_CONFLICT'),
    );
    assert.deepEqual(await service.findOne(future.id), future);
  });

  test('issue links prohibit future editing and shortening the issue-covered interval', async () => {
    const f = await fixture();
    const norm = await service.create(f.payload, actor);
    const employee = await prisma.employee.create({
      data: {
        lastName: 'Tester',
        firstName: 'Issue',
        positionId: f.position.id,
      },
    });
    await prisma.ppeIssue.create({
      data: {
        employeeId: employee.id,
        employeeNameSnapshot: 'Tester Issue',
        positionId: f.position.id,
        positionNameSnapshot: f.position.name,
        normItemId: norm.items[0].id,
        issueType: 'REGULAR',
        normItemPpeItemId: f.items[0].id,
        normPpeArticleSnapshot: f.items[0].article,
        normPpeNameSnapshot: f.items[0].name,
        ppeItemId: f.items[0].id,
        ppeArticleSnapshot: f.items[0].article,
        ppeNameSnapshot: f.items[0].name,
        ppeItemTypeSnapshot: f.items[0].type,
        ppeUnitSnapshot: f.items[0].unit,
        quantity: 1,
        issuedAt: date(20),
        scheduledAt: date(10),
        scheduledPortion: 0,
        issuedByUserId: actor,
        issuedByNameSnapshot: 'Norm tester',
      },
    });
    await assert.rejects(
      service.updateFuture(
        norm.id,
        { effectiveFrom: day(11), items: f.rows },
        actor,
      ),
      errorCode('PPE_NORM_LOCKED'),
    );
    await assert.rejects(
      service.createRevision(
        norm.id,
        { effectiveFrom: day(15), items: f.rows },
        actor,
      ),
      errorCode('PPE_NORM_LOCKED'),
    );
    assert.deepEqual(await service.findOne(norm.id), norm);
  });
}
