import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const {
    prisma,
    issues,
    issueFixture,
    specialist,
    adminActor,
    day,
    date,
    errorCode,
    actor,
  } = env;
  test('regular issue uses employee norm, derived quantity/date/size and one compact audit event', async () => {
    const f = await issueFixture();
    const [issue] = await issues.createRegular(f.request, specialist);
    assert.equal(issue.issueType, 'REGULAR');
    assert.equal(issue.scheduledAt, day(-2));
    assert.equal(issue.issuedAt, day());
    assert.equal(issue.quantity, 2);
    assert.equal(issue.sizeValue, '42');
    assert.equal(issue.normItemId, f.norm.items[0].id);
    assert.equal(issue.issuedByUserId, actor);
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'ppe_issue', entityId: issue.id },
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].module, 'PPE');
    assert.equal(logs[0].action, 'CREATE');
    assert.equal(logs[0].fieldName, null);
    assert.equal(logs[0].newValue, null);
    assert.equal(logs[0].userId, actor);
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].available, null);
    assert.equal(plan.items[0].fulfilled.length, 1);
    const from = new Date(`${day()}T00:00:00Z`);
    const targetMonth = from.getUTCMonth() + 12;
    const lastDay = new Date(
      Date.UTC(from.getUTCFullYear(), targetMonth + 1, 0),
    ).getUTCDate();
    const expectedNext = new Date(
      Date.UTC(
        from.getUTCFullYear(),
        targetMonth,
        Math.min(from.getUTCDate(), lastDay),
      ),
    );
    assert.equal(
      plan.items[0].nextFuture.scheduledAt,
      expectedNext.toISOString().slice(0, 10),
    );
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_NOT_DUE'),
    );
  });
  test('closed obligation cannot be issued twice; fractional norm issues the full quantity', async () => {
    const f = await issueFixture({ quantity: 1.125 });
    const [issue] = await issues.createRegular(f.request, specialist);
    assert.equal(issue.quantity, 1.125);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_NOT_DUE'),
    );
  });
  test('admin backdating chooses the norm effective on issuedAt; specialist cannot provide issuedAt', async () => {
    const f = await issueFixture({ from: day(-60), quantity: 1 });
    await prisma.ppeNorm.update({
      where: { id: f.norm.id },
      data: { effectiveTo: date(-11) },
    });
    await env.service.create(
      {
        positionId: f.position.id,
        gender: 'MALE',
        effectiveFrom: day(-10),
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
    const [issue] = await issues.createRegular(
      { ...f.request, issuedAt: day(-30) },
      adminActor,
    );
    assert.equal(issue.issuedAt, day(-30));
    assert.equal(issue.scheduledAt, day(-60));
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_ITEM_NOT_FOUND'),
    );
    await assert.rejects(
      async () =>
        issues.createRegular({ ...f.request, issuedAt: day(-30) }, specialist),
      errorCode('PPE_ISSUE_BACKDATE_FORBIDDEN'),
    );
    await assert.rejects(
      issues.createRegular({ ...f.request, issuedAt: day(-61) }, adminActor),
      errorCode('PPE_NORM_NOT_FOUND'),
    );
  });
  test('closes the nearest outstanding obligation without creating debt for every missed period', async () => {
    const f = await issueFixture({ from: '2024-01-06', quantity: 1 });
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].plannedDate, '2024-01-06');
    const [issued] = await issues.createRegular(f.request, specialist);
    assert.equal(issued.scheduledAt, '2024-01-06');
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].overdue,
      0,
    );
  });
  test('replacement preserves normative and actual PPE and closes the required obligation', async () => {
    const f = await issueFixture({ quantity: 1 });
    await prisma.ppeItem.update({
      where: { id: f.items[2].id },
      data: { type: f.ppe.type, unit: f.ppe.unit },
    });
    const [issue] = await issues.createRegular(
      {
        ...f.request,
        items: [{ ...f.request.items[0], ppeItemId: f.items[2].id }],
      },
      specialist,
    );
    assert.equal(issue.normItemPpeItemId, f.ppe.id);
    assert.equal(issue.normPpeArticle, f.ppe.article);
    assert.equal(issue.ppeItemId, f.items[2].id);
    assert.equal(issue.article, f.items[2].article);
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].fulfilled.length,
      1,
    );
    assert.equal(
      (
        await prisma.ppeNormItem.findUnique({
          where: { id: f.norm.items[0].id },
        })
      ).ppeItemId,
      f.ppe.id,
    );
  });
  test('rejects inactive employees, nonexistent/inactive actual PPE and foreign norm items', async () => {
    const f = await issueFixture();
    await prisma.employee.update({
      where: { id: f.employee.id },
      data: { isActive: false },
    });
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_EMPLOYEE_INACTIVE'),
    );
    await prisma.employee.update({
      where: { id: f.employee.id },
      data: { isActive: true },
    });
    await assert.rejects(
      issues.createRegular(
        {
          ...f.request,
          items: [{ ...f.request.items[0], ppeItemId: 2147483647 }],
        },
        specialist,
      ),
      errorCode('PPE_ITEM_NOT_FOUND'),
    );
    await prisma.ppeItem.update({
      where: { id: f.ppe.id },
      data: { isActive: false },
    });
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_ITEM_INACTIVE'),
    );
    await prisma.ppeItem.update({
      where: { id: f.ppe.id },
      data: { isActive: true },
    });
    const other = await issueFixture();
    await assert.rejects(
      issues.createRegular(
        {
          ...f.request,
          items: [
            { ...f.request.items[0], normItemId: other.norm.items[0].id },
          ],
        },
        specialist,
      ),
      errorCode('PPE_NORM_ITEM_NOT_FOUND'),
    );
    assert.equal(
      await prisma.ppeIssue.count({ where: { employeeId: f.employee.id } }),
      0,
    );
  });
  test('plan without an effective norm returns an empty plan', async () => {
    const f = await issueFixture({ from: day(31) });
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.norm, null);
    assert.deepEqual(plan.items, []);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_NOT_DUE'),
    );
  });
}
