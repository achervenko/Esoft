import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmployeeAdminService } from './ppe-employee-admin-test-helper.mjs';

export function registerTests(env) {
  const employees = createEmployeeAdminService(env);
  test('assignment date limits entitlement while legacy null starts at norm effective date', async () => {
    for (const assignedAt of [env.day(-5), null]) {
      const f = await env.issueFixture({ from: env.day(-60), assignedAt });
      assert.equal(
        f.employee.positionAssignedAt?.toISOString().slice(0, 10) ?? null,
        assignedAt,
      );
      const row = (await env.issues.plan(f.employee.id, env.date())).items[0];
      assert.equal(row.available.scheduledAt, assignedAt ?? env.day(-60));
      const [issue] = await env.issues.createRegular(f.request, env.specialist);
      assert.equal(issue.scheduledAt, assignedAt ?? env.day(-60));
    }
  });

  test('combined positions union PPE and take the larger quantity without duplicate issue', async () => {
    const first = await env.issueFixture({ quantity: 2 });
    const second = await env.issueFixture({ quantity: 5 });
    const source = await env.prisma.ppeNormItem.findUniqueOrThrow({
      where: { id: second.norm.items[0].id },
    });
    await env.prisma.ppeNormItem.create({
      data: {
        normId: second.norm.id,
        ppeItemId: first.ppe.id,
        quantity: 5,
        ppeNameSnapshot: first.ppe.name,
        ppeUnitSnapshot: first.ppe.unit,
        ppeItemTypeSnapshot: first.ppe.type,
        periodCount: source.periodCount,
        periodUnit: source.periodUnit,
      },
    });
    await env.prisma.employeePosition.create({
      data: {
        employeeId: first.employee.id,
        positionId: second.position.id,
        assignedAt: new Date(env.day(-2)),
      },
    });
    const plan = await env.issues.plan(first.employee.id, env.date());
    assert.equal(plan.items.length, 2);
    const common = plan.items.find((row) => row.ppeItemId === first.ppe.id);
    assert.equal(common.normQuantity, 5);
    assert.equal(common.available.quantity, 5);
    await assert.rejects(
      env.issues.createRegular(first.request, env.specialist),
      env.errorCode('PPE_NORM_ITEM_NOT_FOUND'),
    );
    const request = {
      employeeId: first.employee.id,
      items: [{ normItemId: common.normItemId, ppeItemId: first.ppe.id }],
    };
    const [issued] = await env.issues.createRegular(request, env.specialist);
    assert.equal(issued.quantity, 5);
    assert.equal(issued.positionId, second.position.id);
    assert.equal(
      (await env.issues.plan(first.employee.id, env.date())).items.find(
        (row) => row.ppeItemId === first.ppe.id,
      ).available,
      null,
    );
    await assert.rejects(env.issues.createRegular(request, env.specialist));
    await env.prisma.employeePosition.delete({
      where: {
        employeeId_positionId: {
          employeeId: first.employee.id,
          positionId: second.position.id,
        },
      },
    });
    const after = await env.issues.plan(first.employee.id, env.date());
    assert.equal(after.items.length, 1);
    assert.equal(after.items[0].available, null);
  });
  test('swapping primary and additional positions preserves continuous assignment dates', async () => {
    const first = await env.issueFixture();
    const second = await env.issueFixture();
    const primaryDate = new Date(env.day(-100));
    const additionalDate = new Date(env.day(-60));
    await env.prisma.employee.update({
      where: { id: first.employee.id },
      data: {
        positionAssignedAt: primaryDate,
        additionalPositions: {
          create: {
            positionId: second.position.id,
            assignedAt: additionalDate,
          },
        },
      },
    });
    await employees.updateEmployee(
      first.employee.id,
      {
        firstName: first.employee.firstName,
        lastName: first.employee.lastName,
        positionId: second.position.id,
        gender: 'MALE',
        additionalPositionIds: [first.position.id],
      },
      env.actor,
    );
    const employee = await env.prisma.employee.findUniqueOrThrow({
      where: { id: first.employee.id },
      include: { additionalPositions: true },
    });
    assert.equal(Number(employee.positionAssignedAt), Number(additionalDate));
    assert.equal(employee.additionalPositions.length, 1);
    assert.equal(employee.additionalPositions[0].positionId, first.position.id);
    assert.equal(
      Number(employee.additionalPositions[0].assignedAt),
      Number(primaryDate),
    );
  });

  test('employee API validates, retains and removes additional assignments atomically', async () => {
    const first = await env.issueFixture();
    const second = await env.issueFixture();
    const payload = {
      gender: 'MALE',
      firstName: 'Combined',
      lastName: 'Employee',
      positionId: first.position.id,
    };
    const created = await employees.createEmployee(
      { ...payload, additionalPositionIds: [second.position.id] },
      env.actor,
    );
    assert.deepEqual(
      created.additionalPositions.map(({ id }) => id),
      [second.position.id],
    );
    const key = {
      employeeId_positionId: {
        employeeId: created.id,
        positionId: second.position.id,
      },
    };
    const assigned = await env.prisma.employeePosition.findUniqueOrThrow({
      where: key,
    });
    const retained = await employees.updateEmployee(
      created.id,
      payload,
      env.actor,
    );
    assert.equal(retained.additionalPositions.length, 1);
    assert.equal(
      Number(
        (await env.prisma.employeePosition.findUniqueOrThrow({ where: key }))
          .assignedAt,
      ),
      Number(assigned.assignedAt),
    );
    await env.prisma.position.update({
      where: { id: second.position.id },
      data: { isActive: false },
    });
    await employees.updateEmployee(created.id, payload, env.actor);
    await employees.updateEmployee(
      created.id,
      { ...payload, additionalPositionIds: [] },
      env.actor,
    );
    assert.equal(
      await env.prisma.employeePosition.count({
        where: { employeeId: created.id },
      }),
      0,
    );
    await assert.rejects(
      employees.updateEmployee(
        created.id,
        { ...payload, additionalPositionIds: [second.position.id] },
        env.actor,
      ),
      env.errorCode('POSITION_INACTIVE'),
    );
  });
  test('a newly created employee starts one whole obligation on assignment', async () => {
    const f = await env.issueFixture({ from: env.day(-200), quantity: 60 });
    const employee = await employees.createEmployee(
      {
        firstName: 'New',
        lastName: 'Employee',
        positionId: f.position.id,
        gender: 'MALE',
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
}
