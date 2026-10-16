import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { issues, issueFixture, day, date, specialist, actor } = env;

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
    await issues.cancel(first.id, { reason: 'Ошибочная запись' }, actor);
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
}
