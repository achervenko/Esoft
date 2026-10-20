import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { prisma, issues, issueFixture, specialist, date, actor, errorCode } =
    env;
  test('cancel reopens the same normative obligation and preserves original issue data', async () => {
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
