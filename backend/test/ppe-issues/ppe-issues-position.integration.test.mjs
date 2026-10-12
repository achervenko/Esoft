import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  EmployeesAdminService,
} = require('../../dist/src/users-admin/employees-admin.service.js');
const {
  UsersAdminAuditService,
} = require('../../dist/src/users-admin/users-admin-audit.service.js');

export function registerTests(env) {
  const employees = new EmployeesAdminService(
    new UsersAdminAuditService(new env.AuditLogService(env.prisma)),
    env.prisma,
  );
  test('a newly created employee starts one whole obligation on assignment', async () => {
    const f = await env.issueFixture({ from: env.day(-200), quantity: 60 });
    const employee = await employees.createEmployee(
      {
        firstName: 'New',
        lastName: 'Employee',
        positionId: f.position.id,
      },
      env.actor,
    );
    const row = (await env.issues.plan(employee.id, env.date())).items[0];
    assert.equal(row.available.scheduledAt, env.day());
    assert.equal(row.available.quantity, 60);
    const request = {
      employeeId: employee.id,
      items: [{ ...f.request.items[0], sizeId: f.sizes[0].id }],
    };
    const [created] = await env.issues.createRegular(request, env.adminActor);
    assert.equal(created.quantity, 60);
    assert.equal(
      (await env.issues.plan(employee.id, env.date())).items[0].available,
      null,
    );
  });
  async function assign(f, position) {
    await employees.updateEmployee(
      f.employee.id,
      {
        firstName: f.employee.firstName,
        lastName: f.employee.lastName,
        positionId: position.id,
      },
      env.actor,
    );
    assert.equal(
      (
        await env.prisma.employee.findUniqueOrThrow({
          where: { id: f.employee.id },
        })
      ).positionAssignedAt
        .toISOString()
        .slice(0, 10),
      env.day(),
    );
  }
  test('position transfer keeps common PPE, issues missing items and enforces the same rule on POST', async () => {
    const f = await env.issueFixture({ from: env.day(-60), quantity: 1 });
    const [old] = await env.issues.createRegular(
      { ...f.request, issuedAt: env.day(-30) },
      env.adminActor,
    );
    const target = await env.fixture();
    const next = await env.service.create(
      {
        positionId: target.position.id,
        effectiveFrom: env.day(-200),
        items: [
          {
            ppeItemId: f.ppe.id,
            quantity: 2,
            periodCount: 1,
            periodUnit: 'YEAR',
          },
          {
            ppeItemId: target.items[1].id,
            quantity: 1,
            periodCount: 1,
            periodUnit: 'YEAR',
          },
        ],
      },
      env.actor,
    );
    await assign(f, target.position);
    const plan = await env.issues.plan(f.employee.id, env.date());
    const common = plan.items.find((item) => item.ppeItemId === f.ppe.id);
    const missing = plan.items.find(
      (item) => item.ppeItemId === target.items[1].id,
    );
    assert.equal(common.available, null);
    assert.equal(missing.available.scheduledAt, env.day());
    const commonRequest = {
      employeeId: f.employee.id,
      items: [{ normItemId: common.normItemId, ppeItemId: f.ppe.id }],
    };
    await assert.rejects(
      env.issues.createRegular(commonRequest, env.adminActor),
      env.errorCode('PPE_NORM_NOT_DUE'),
    );
    const request = {
      employeeId: f.employee.id,
      items: [{ normItemId: missing.normItemId, ppeItemId: missing.ppeItemId }],
    };
    const attempts = await Promise.allSettled([
      env.issues.createRegular(request, env.adminActor),
      env.issues.createRegular(request, env.adminActor),
    ]);
    assert.equal(
      attempts.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const unchanged = await env.prisma.ppeIssue.findUniqueOrThrow({
      where: { id: old.id },
    });
    assert.equal(unchanged.positionId, f.position.id);
    assert.equal(unchanged.normItemId, f.norm.items[0].id);
    assert.equal(next.items.length, 2);
  });
}
