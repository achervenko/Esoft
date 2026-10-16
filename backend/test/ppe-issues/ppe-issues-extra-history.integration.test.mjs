import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const {
    prisma,
    issues,
    issueFixture,
    specialist,
    adminActor,
    date,
    day,
    actor,
    errorCode,
  } = env;
  test('EXTRA can issue outside the norm without closing or moving REGULAR needs', async () => {
    const f = await issueFixture();
    const before = await issues.plan(f.employee.id, date());
    const [extra] = await issues.createExtra(
      {
        employeeId: f.employee.id,
        items: [{ ppeItemId: f.items[2].id, quantity: 4 }],
      },
      specialist,
    );
    assert.equal(extra.issueType, 'EXTRA');
    assert.equal(extra.normItemId, null);
    assert.equal(extra.scheduledAt, null);
    assert.equal(extra.quantity, 4);
    const after = await issues.plan(f.employee.id, date());
    assert.deepEqual(after, before);
    await issues.createRegular(f.request, specialist);
  });
  test('EXTRA is allowed when no norm is effective, but still requires catalog entries', async () => {
    const f = await issueFixture({ from: day(10) });
    const request = {
      employeeId: f.employee.id,
      items: [{ ppeItemId: f.items[2].id, quantity: 0.5 }],
    };
    assert.equal(
      (await issues.createExtra(request, specialist))[0].quantity,
      0.5,
    );
    await assert.rejects(
      issues.createExtra(
        { ...request, items: [{ ppeItemId: 2147483647, quantity: 1 }] },
        specialist,
      ),
      errorCode('PPE_ITEM_NOT_FOUND'),
    );
  });
  test('EXTRA also resolves the employee size without affecting the regular schedule', async () => {
    const f = await issueFixture();
    const before = await issues.plan(f.employee.id, date());
    const [issue] = await issues.createExtra(
      {
        employeeId: f.employee.id,
        items: [{ ppeItemId: f.ppe.id, quantity: 1 }],
      },
      specialist,
    );
    assert.equal(issue.sizeValue, '42');
    assert.deepEqual(await issues.plan(f.employee.id, date()), before);
  });
  test('historical DTO snapshots survive renaming and disabling references, employee size and issuer changes', async () => {
    const f = await issueFixture();
    const [created] = await issues.createRegular(f.request, specialist);
    const original = await issues.findOne(created.id);
    const oldActor = await prisma.user.findUnique({ where: { id: actor } });
    try {
      await prisma.employee.update({
        where: { id: f.employee.id },
        data: {
          firstName: 'Renamed',
          isActive: false,
          ppeSizes: { update: { shoeSize: 43 } },
        },
      });
      await prisma.position.update({
        where: { id: f.position.id },
        data: { name: `${f.position.name} changed`, isActive: false },
      });
      await prisma.ppeItem.update({
        where: { id: f.ppe.id },
        data: {
          article: `${f.ppe.article}-changed`,
          name: 'Changed item',
          unit: 'шт',
          isActive: false,
          type: 'OTHER',
        },
      });
      await prisma.user.update({
        where: { id: actor },
        data: { name: 'Changed issuer' },
      });
      assert.deepEqual(await issues.findOne(original.id), original);
      assert.deepEqual(
        (await issues.list({ employeeId: String(f.employee.id) }))[0],
        original,
      );
      const cancelled = await issues.cancel(
        original.id,
        { reason: 'Correction' },
        actor,
      );
      assert.equal(cancelled.cancelledByName, 'Changed issuer');
      assert.equal(cancelled.issuedByName, original.issuedByName);
      assert.equal(cancelled.article, original.article);
      assert.equal(cancelled.employeeName, original.employeeName);
    } finally {
      await prisma.user.update({
        where: { id: actor },
        data: { name: oldActor.name },
      });
    }
  });
  test('journal filters combine employee, position, actual PPE, issue type, status and inclusive dates', async () => {
    const f = await issueFixture();
    const [issue] = await issues.createExtra(
      {
        employeeId: f.employee.id,
        issuedAt: day(-1),
        items: [{ ppeItemId: f.items[2].id, quantity: 1 }],
      },
      adminActor,
    );
    const filters = {
      employeeId: String(f.employee.id),
      positionId: String(f.position.id),
      ppeItemId: String(f.items[2].id),
      issueType: 'EXTRA',
      status: 'ISSUED',
      dateFrom: day(-1),
      dateTo: day(-1),
    };
    assert.deepEqual(await issues.list(filters), [
      await issues.findOne(issue.id),
    ]);
    assert.deepEqual(
      await issues.list({ ...filters, dateFrom: day(), dateTo: day() }),
      [],
    );
    await issues.cancel(issue.id, { reason: 'wrong' }, actor);
    assert.deepEqual(await issues.list(filters), []);
    assert.equal(
      (await issues.list({ ...filters, status: 'CANCELLED' })).length,
      1,
    );
    await assert.rejects(
      issues.findOne(2147483647),
      errorCode('PPE_ISSUE_NOT_FOUND'),
    );
    await assert.rejects(
      issues.cancel(2147483647, { reason: 'wrong' }, actor),
      errorCode('PPE_ISSUE_NOT_FOUND'),
    );
  });
}
