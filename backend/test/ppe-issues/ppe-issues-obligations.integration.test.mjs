import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const {
    issues,
    issueFixture,
    day,
    date,
    specialist,
    adminActor,
    actor,
    prisma,
    errorCode,
  } = env;

  test('merges current duties and only open future duties; mixed issuance is atomic', async () => {
    const f = await issueFixture({
      from: day(17),
      quantity: 2,
      multiple: true,
    });
    await prisma.ppeNormItem.update({
      where: { id: f.norm.items[1].id },
      data: { periodCount: 7, periodUnit: 'DAY' },
    });
    const current = await env.service.create(
      {
        positionId: f.position.id,
        effectiveFrom: day(-60),
        effectiveTo: day(16),
        items: f.norm.items.map((item) => ({
          ppeItemId: item.ppeItemId,
          quantity: 1,
          periodCount: 1,
          periodUnit: 'YEAR',
        })),
      },
      actor,
    );
    const plan = await issues.plan(f.employee.id, date());
    assert.deepEqual(
      plan.items.map((row) => row.normItemId),
      [...current.items.map((item) => item.id), f.norm.items[0].id],
    );
    assert.equal(plan.items[2].normId, f.norm.id);
    assert.equal(plan.items[2].normEffectiveFrom, day(17));
    assert.ok(plan.items.slice(0, 2).every((row) => row.available !== null));
    const oldRow = { normItemId: current.items[0].id, ppeItemId: f.ppe.id };
    const earlyRow = f.request.items[0];
    const unopenedRow = {
      normItemId: f.norm.items[1].id,
      ppeItemId: f.norm.items[1].ppeItemId,
    };
    await assert.rejects(
      issues.createRegular(
        { employeeId: f.employee.id, items: [oldRow, earlyRow, unopenedRow] },
        specialist,
      ),
      errorCode('PPE_NORM_NOT_DUE'),
    );
    assert.equal(
      await prisma.ppeIssue.count({ where: { employeeId: f.employee.id } }),
      0,
    );
    const issued = await issues.createRegular(
      { employeeId: f.employee.id, items: [oldRow, earlyRow] },
      specialist,
    );
    assert.deepEqual(
      issued.map((row) => row.normItemId),
      [current.items[0].id, f.norm.items[0].id],
    );
    assert.deepEqual(
      issued.map((row) => row.quantity),
      [1, 2],
    );
    assert.deepEqual(
      issued.map((row) => row.scheduledAt),
      [day(-60), day(17)],
    );
    const refreshed = await issues.plan(f.employee.id, date());
    assert.ok(
      refreshed.items.some(
        (row) => row.normItemId === current.items[1].id && row.available,
      ),
    );
    assert.ok(
      !refreshed.items.some((row) => row.normItemId === f.norm.items[0].id),
    );
  });

  test('opens annual issue exactly thirty days early and retains planned anchor', async () => {
    const f = await issueFixture({
      from: day(-365),
      quantity: 2,
      periodCount: 365,
      periodUnit: 'DAY',
    });
    await issues.createRegular(
      { ...f.request, issuedAt: day(-365) },
      adminActor,
    );
    await assert.rejects(
      issues.createRegular({ ...f.request, issuedAt: day(-31) }, adminActor),
      errorCode('PPE_NORM_NOT_DUE'),
    );
    const early = await issues.plan(f.employee.id, date(-30));
    assert.equal(early.items[0].obligationStatus, 'EARLY');
    assert.equal(early.items[0].plannedDate, day());
    assert.equal(early.items[0].availableFrom, day(-30));
    const [issued] = await issues.createRegular(
      { ...f.request, issuedAt: day(-30) },
      adminActor,
    );
    assert.equal(issued.scheduledAt, day());
    assert.equal(issued.quantity, 2);
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].plannedDate,
      day(365),
    );
  });

  test('weekly issuance can close two consecutive obligations today but not a third', async () => {
    const f = await issueFixture({
      from: day(),
      quantity: 2,
      periodCount: 7,
      periodUnit: 'DAY',
    });
    const [first] = await issues.createRegular(f.request, specialist);
    const [second] = await issues.createRegular(f.request, specialist);
    assert.equal(first.scheduledAt, day());
    assert.equal(second.scheduledAt, day(7));
    assert.equal(second.quantity, 2);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_NOT_DUE'),
    );
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].plannedDate, day(14));
    assert.equal(plan.items[0].availableFrom, day(7));
  });

  test('late issuance advances deadline and quantities remain literal for fractional volumes', async () => {
    const f = await issueFixture({
      from: day(-5),
      quantity: 0.125,
      periodCount: 20,
      periodUnit: 'DAY',
      unit: 'мл',
      type: 'OTHER',
    });
    const before = await issues.plan(f.employee.id, date());
    assert.equal(before.items[0].obligationStatus, 'OVERDUE');
    const [issued] = await issues.createRegular(f.request, specialist);
    assert.equal(issued.quantity, 0.125);
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].plannedDate,
      day(20),
    );
  });
}
