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
    errorCode,
  } = env;

  test('issues the first obligation of a future norm through the plan and POST', async () => {
    const f = await issueFixture({
      from: day(17),
      quantity: 2,
      periodCount: 1,
      periodUnit: 'YEAR',
    });
    await assert.rejects(
      issues.createRegular({ ...f.request, issuedAt: day(-14) }, adminActor),
      errorCode('PPE_NORM_NOT_DUE'),
    );
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.norm.id, f.norm.id);
    assert.equal(plan.items[0].obligationStatus, 'EARLY');
    assert.equal(plan.items[0].plannedDate, day(17));
    assert.equal(plan.items[0].availableFrom, day(-13));
    const [issued] = await issues.createRegular(f.request, specialist);
    assert.equal(issued.scheduledAt, day(17));
    assert.equal(issued.quantity, 2);
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].plannedDate,
      (() => {
        const next = date(17);
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        return next.toISOString().slice(0, 10);
      })(),
    );
  });

  test('selects requested future norm even while the previous norm is active', async () => {
    const f = await issueFixture({ from: day(17), quantity: 2 });
    const previous = await env.service.create(
      {
        positionId: f.position.id,
        gender: 'MALE',
        effectiveFrom: day(-60),
        effectiveTo: day(16),
        items: [
          {
            ppeItemId: f.ppe.id,
            quantity: 1,
            periodCount: 1,
            periodUnit: 'YEAR',
          },
        ],
      },
      actor,
    );
    const beforeWindow = await issues.plan(f.employee.id, date(-14));
    assert.equal(beforeWindow.norm.id, previous.id);
    const earlyPlan = await issues.plan(f.employee.id, date());
    assert.equal(earlyPlan.norm.id, previous.id);
    assert.ok(
      earlyPlan.items.some(
        (row) => row.normItemId === previous.items[0].id && row.available,
      ),
    );
    const futureRow = earlyPlan.items.find(
      (row) => row.normItemId === f.norm.items[0].id,
    );
    assert.equal(futureRow.normItemId, f.norm.items[0].id);
    assert.equal(futureRow.obligationStatus, 'EARLY');
    assert.equal(futureRow.availableFrom, day(-13));
    const [issued] = await issues.createRegular(f.request, specialist);
    assert.equal(issued.normItemId, f.norm.items[0].id);
    assert.equal(issued.scheduledAt, day(17));
    assert.equal(issued.quantity, 2);
  });

  test('keeps the active norm until the shorter future window actually opens', async () => {
    const f = await issueFixture({
      from: day(5),
      quantity: 2,
      periodCount: 7,
      periodUnit: 'DAY',
    });
    const previous = await env.service.create(
      {
        positionId: f.position.id,
        gender: 'MALE',
        effectiveFrom: day(-60),
        effectiveTo: day(4),
        items: [
          {
            ppeItemId: f.ppe.id,
            quantity: 1,
            periodCount: 1,
            periodUnit: 'YEAR',
          },
        ],
      },
      actor,
    );
    assert.equal(
      (await issues.plan(f.employee.id, date(-3))).norm.id,
      previous.id,
    );
    const opened = await issues.plan(f.employee.id, date(-2));
    assert.equal(opened.norm.id, previous.id);
    const futureRow = opened.items.find(
      (row) => row.normItemId === f.norm.items[0].id,
    );
    assert.equal(futureRow.availableFrom, day(-2));
    assert.equal(futureRow.obligationStatus, 'EARLY');
    const [issued] = await issues.createRegular(
      { ...f.request, issuedAt: day(-2) },
      adminActor,
    );
    assert.equal(issued.scheduledAt, futureRow.plannedDate);
  });
}
