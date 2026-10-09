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
    assert.equal(issue.quantity, 1);
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
    const from = new Date(`${day(-2)}T00:00:00Z`);
    const targetMonth = from.getUTCMonth() + 6;
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
  test('fully issued cycle cannot be closed twice; fractional norm issues one full portion', async () => {
    const f = await issueFixture({ quantity: 1.125 });
    const [issue] = await issues.createRegular(f.request, specialist);
    assert.equal(issue.quantity, 1.125);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_ALREADY_ISSUED'),
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
  test('only the current normative cycle is considered, without historical debt', async () => {
    const f = await issueFixture({ from: '2024-01-06', quantity: 1 });
    const now = date();
    const year =
      now.getUTCFullYear() -
      (now < new Date(`${now.getUTCFullYear()}-01-06T00:00:00Z`) ? 1 : 0);
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].cycleFrom, `${year}-01-06`);
    assert.equal(plan.items[0].dueUnissued, 1);
    const [issue] = await issues.createRegular(f.request, specialist);
    assert.equal(issue.scheduledAt, `${year}-01-06`);
  });
  test('replacement preserves normative and actual PPE and closes the required portion', async () => {
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
      (await issues.plan(f.employee.id, date())).items[0].fulfilledPortions,
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
  test('batch creates distinct issues for several norm items', async () => {
    const f = await issueFixture({ multiple: true });
    const result = await issues.createRegular(
      {
        employeeId: f.employee.id,
        items: f.norm.items.map((item) => ({
          normItemId: item.id,
          ppeItemId: item.ppeItemId,
        })),
      },
      specialist,
    );
    assert.equal(result.length, 2);
    assert.notEqual(result[0].id, result[1].id);
    assert.equal(result[0].employeeId, result[1].employeeId);
  });
  test('same-day unit portions remain distinct by scheduledPortion even in one batch', async () => {
    const f = await issueFixture({
      quantity: 999_999_999,
      periodUnit: 'MONTH',
    });
    const results = await issues.createRegular(
      { ...f.request, items: [f.request.items[0], f.request.items[0]] },
      specialist,
    );
    assert.equal(results[0].scheduledAt, results[1].scheduledAt);
    assert.equal(results[0].scheduledPortion, 0);
    assert.equal(results[1].scheduledPortion, 1);
    assert.equal(results[0].quantity, 1);
    assert.equal(results[1].quantity, 1);
  });
  test('plan without an effective norm returns an empty plan', async () => {
    const f = await issueFixture({ from: day(10) });
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.norm, null);
    assert.deepEqual(plan.items, []);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_NORM_NOT_FOUND'),
    );
  });
  test('cancel reopens the same normative portion and preserves original issue data', async () => {
    const f = await issueFixture({ quantity: 1 });
    const [original] = await issues.createRegular(f.request, specialist);
    const cancelled = await issues.cancel(
      original.id,
      { reason: '  Ошибка  ' },
      actor,
    );
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.cancellationReason, 'Ошибка');
    for (const field of [
      'employeeName',
      'position',
      'article',
      'quantity',
      'scheduledAt',
      'issuedAt',
      'sizeValue',
      'issueType',
    ])
      assert.deepEqual(cancelled[field], original[field]);
    assert.ok(cancelled.cancelledAt);
    assert.equal(cancelled.cancelledByUserId, actor);
    await assert.rejects(
      issues.cancel(original.id, { reason: 'again' }, actor),
      errorCode('PPE_ISSUE_ALREADY_CANCELLED'),
    );
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].available.scheduledAt, original.scheduledAt);
    assert.equal(plan.items[0].fulfilled.length, 0);
    const [reissued] = await issues.createRegular(f.request, specialist);
    assert.equal(reissued.scheduledAt, original.scheduledAt);
    assert.notEqual(reissued.id, original.id);
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'ppe_issue',
        entityId: original.id,
        action: 'STATUS_CHANGE',
      },
    });
    assert.equal(logs.length, 2);
    assert.deepEqual(
      logs
        .map(({ fieldName, oldValue, newValue }) => ({
          fieldName,
          oldValue,
          newValue,
        }))
        .sort((a, b) => a.fieldName.localeCompare(b.fieldName)),
      [
        {
          fieldName: 'Причина отмены',
          oldValue: 'не указано',
          newValue: 'Ошибка',
        },
        {
          fieldName: 'Статус выдачи',
          oldValue: 'ISSUED',
          newValue: 'CANCELLED',
        },
      ].sort((a, b) => a.fieldName.localeCompare(b.fieldName)),
    );
    assert.ok(logs.every((log) => log.userId === actor));
  });
}
