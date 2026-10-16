import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const { issues, issueFixture, date, specialist, prisma } = env;

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
}
