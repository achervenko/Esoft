import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createPpeIssueTestEnvironment } from './ppe-issues.integration.setup.mjs';
import { registerTests as transactionTests } from './ppe-issues-transactions-concurrency.integration.test.mjs';
const env = await createPpeIssueTestEnvironment();
after(() => env.cleanup());
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

for (const periodUnit of ['DAY', 'MONTH', 'YEAR']) {
  test(`serializes ${periodUnit} through database, norm DTO and plan`, async () => {
    const f = await issueFixture({ quantity: 2, periodCount: 7, periodUnit });
    assert.equal(f.norm.items[0].periodUnit, periodUnit);
    assert.equal(
      (
        await prisma.ppeNormItem.findUnique({
          where: { id: f.norm.items[0].id },
        })
      ).periodUnit,
      periodUnit,
    );
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].periodUnit, periodUnit);
    assert.equal(plan.items[0].available.quantity, 2);
    const [issued] = await issues.createRegular(f.request, specialist);
    assert.equal(issued.quantity, 2);
  });
}

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

test('merges current duties and only open future duties; mixed issuance is atomic', async () => {
  const f = await issueFixture({ from: day(17), quantity: 2, multiple: true });
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
  await issues.createRegular({ ...f.request, issuedAt: day(-365) }, adminActor);
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

test('EXTRA does not close a norm; cancelled earlier issue reopens even after later issuance', async () => {
  const f = await issueFixture({
    from: day(),
    quantity: 2,
    periodCount: 7,
    periodUnit: 'DAY',
  });
  await issues.createExtra(
    {
      employeeId: f.employee.id,
      items: [{ ppeItemId: f.ppe.id, quantity: 10 }],
    },
    specialist,
  );
  assert.equal(
    (await issues.plan(f.employee.id, date())).items[0].plannedDate,
    day(),
  );
  const [first] = await issues.createRegular(f.request, specialist);
  await issues.createRegular(f.request, specialist);
  await issues.cancel(
    first.id,
    { reason: 'Ошибочная запись' },
    actor,
  );
  assert.equal(
    (await issues.plan(f.employee.id, date())).items[0].plannedDate,
    day(),
  );
  const [replacement] = await issues.createRegular(f.request, specialist);
  assert.equal(replacement.scheduledAt, day());
  assert.equal(
    (await issues.plan(f.employee.id, date())).items[0].plannedDate,
    day(14),
  );
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
transactionTests(env);
