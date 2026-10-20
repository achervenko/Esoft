import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { prisma, issues, issueFixture, specialist, day, errorCode } = env;
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
  test('a weekly batch closes two whole obligations; a third unavailable row rolls back the batch', async () => {
    const f = await issueFixture({
      from: day(),
      quantity: 3,
      periodCount: 7,
      periodUnit: 'DAY',
    });
    await assert.rejects(
      issues.createRegular(
        {
          ...f.request,
          items: [f.request.items[0], f.request.items[0], f.request.items[0]],
        },
        specialist,
      ),
      errorCode('PPE_NORM_NOT_DUE'),
    );
    assert.equal(
      await prisma.ppeIssue.count({ where: { employeeId: f.employee.id } }),
      0,
    );
    const results = await issues.createRegular(
      { ...f.request, items: [f.request.items[0], f.request.items[0]] },
      specialist,
    );
    assert.equal(results[0].scheduledAt, day());
    assert.equal(results[1].scheduledAt, day(7));
    assert.equal(results[0].quantity, 3);
    assert.equal(results[1].quantity, 3);
  });
}
