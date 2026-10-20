import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  test('male and female revision chains and future boundaries remain independent', async () => {
    const f = await env.issueFixture();
    const items = [
      { ppeItemId: f.ppe.id, quantity: 1, periodCount: 1, periodUnit: 'YEAR' },
    ];
    const female = await env.service.create(
      {
        positionId: f.position.id,
        gender: 'FEMALE',
        effectiveFrom: env.day(-2),
        items,
      },
      env.actor,
    );
    const next = await env.service.createRevision(
      female.id,
      { effectiveFrom: env.day(10), items },
      env.actor,
    );
    assert.equal(next.gender, 'FEMALE');
    assert.equal(next.positionId, f.position.id);
    assert.equal((await env.service.findOne(f.norm.id)).effectiveTo, null);
    await env.service.updateFuture(
      next.id,
      { effectiveFrom: env.day(12), items },
      env.actor,
    );
    assert.equal(
      (await env.service.findOne(female.id)).effectiveTo,
      env.day(11),
    );
    assert.equal((await env.service.findOne(f.norm.id)).effectiveTo, null);
    await assert.rejects(
      async () =>
        env.service.updateFuture(
          next.id,
          { gender: 'MALE', effectiveFrom: env.day(12), items },
          env.actor,
        ),
      env.errorCode('UNKNOWN_FIELDS'),
    );
    await assert.rejects(
      env.prisma.ppeNorm.update({
        where: { id: female.id },
        data: { gender: 'MALE' },
      }),
    );
    await assert.rejects(
      env.prisma.ppeNorm.create({
        data: {
          positionId: f.position.id,
          gender: 'MALE',
          effectiveFrom: new Date(env.day()),
        },
      }),
    );
    await env.service.deleteFuture(next.id, env.actor);
    assert.equal((await env.service.findOne(female.id)).effectiveTo, null);
    assert.equal((await env.service.findOne(f.norm.id)).effectiveTo, null);
  });

  test('gender scopes norms, preserves issued PPE after correction and reports missing assignments', async () => {
    const f = await env.issueFixture({ quantity: 2 });
    const payload = {
      positionId: f.position.id,
      gender: 'FEMALE',
      effectiveFrom: env.day(-2),
      items: [
        {
          ppeItemId: f.ppe.id,
          quantity: 3,
          periodCount: 1,
          periodUnit: 'YEAR',
        },
      ],
    };
    const female = await env.service.create(payload, env.actor);
    await assert.rejects(
      env.service.create(payload, env.actor),
      env.errorCode('PPE_NORM_PERIOD_CONFLICT'),
    );
    const malePlan = await env.issues.plan(f.employee.id, env.date());
    assert.equal(malePlan.items[0].normId, f.norm.id);
    const [issued] = await env.issues.createRegular(f.request, env.specialist);
    assert.equal(issued.genderSnapshot, 'MALE');
    await env.prisma.employee.update({
      where: { id: f.employee.id },
      data: { gender: 'FEMALE' },
    });
    const femalePlan = await env.issues.plan(f.employee.id, env.date());
    assert.equal(femalePlan.items[0].normId, female.id);
    assert.equal(femalePlan.items[0].available, null);
    await assert.rejects(
      env.issues.createRegular(
        {
          employeeId: f.employee.id,
          items: [{ normItemId: female.items[0].id, ppeItemId: f.ppe.id }],
        },
        env.specialist,
      ),
      env.errorCode('PPE_NORM_NOT_DUE'),
    );
    const other = await env.issueFixture();
    await env.prisma.employeePosition.create({
      data: {
        employeeId: f.employee.id,
        positionId: other.position.id,
        assignedAt: new Date(env.day(-2)),
      },
    });
    const partial = await env.issues.plan(f.employee.id, env.date());
    assert.equal(partial.items.length, 1);
    assert.equal(partial.warnings[0].positionId, other.position.id);
    await env.prisma.employee.update({
      where: { id: f.employee.id },
      data: { gender: null },
    });
    await assert.rejects(
      env.issues.plan(f.employee.id, env.date()),
      env.errorCode('PPE_EMPLOYEE_GENDER_REQUIRED'),
    );
    await assert.rejects(
      env.issues.createRegular(f.request, env.specialist),
      env.errorCode('PPE_EMPLOYEE_GENDER_REQUIRED'),
    );
    assert.equal(
      (
        await env.prisma.ppeIssue.findUniqueOrThrow({
          where: { id: issued.id },
        })
      ).genderSnapshot,
      'MALE',
    );
  });
}
