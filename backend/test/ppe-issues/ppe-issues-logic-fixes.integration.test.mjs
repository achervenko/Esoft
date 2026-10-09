import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const {
  PpeCatalogSizesService,
} = require('../../dist/src/ppe/ppe-catalog-sizes.service.js');
const {
  PpeCatalogService,
} = require('../../dist/src/ppe/ppe-catalog.service.js');

export function registerTests(env) {
  test('normalizes API sizes, rejects equivalent duplicates and matches legacy employee ranges', async () => {
    const f = await env.issueFixture({ type: 'BODY' });
    const size = await env.catalog.createSize(
      f.ppe.id,
      { value: '44-46;170 — 176' },
      env.actor,
    );
    assert.equal(size.value, '44–46');
    assert.equal(size.heightValue, '170–176');
    await assert.rejects(
      env.catalog.createSize(f.ppe.id, { value: '44−46;170-176' }, env.actor),
      env.errorCode('PPE_ITEM_SIZE_CONFLICT'),
    );
    await env.prisma.employee.update({
      where: { id: f.employee.id },
      data: { clothingSize: '44—46', clothingHeight: '170 - 176' },
    });
    const [issued] = await env.issues.createRegular(f.request, env.adminActor);
    assert.equal(issued.sizeValue, '44–46');
    assert.equal(issued.clothingHeight, '170–176');
    assert.deepEqual(issued.warnings, []);
  });
  test('regular replacements must match both the norm type and unit', async () => {
    const f = await env.issueFixture();
    const replacement = f.items[1];
    const request = {
      ...f.request,
      items: [{ normItemId: f.norm.items[0].id, ppeItemId: replacement.id }],
    };
    await assert.rejects(
      env.issues.createRegular(request, env.adminActor),
      env.errorCode('PPE_REPLACEMENT_INCOMPATIBLE'),
    );
    await env.prisma.ppeItem.update({
      where: { id: replacement.id },
      data: { type: 'FEET', unit: 'шт' },
    });
    await assert.rejects(
      env.issues.createRegular(request, env.adminActor),
      env.errorCode('PPE_REPLACEMENT_INCOMPATIBLE'),
    );
    assert.equal(
      await env.prisma.ppeIssue.count({ where: { employeeId: f.employee.id } }),
      0,
    );
    await env.prisma.ppeItem.update({
      where: { id: replacement.id },
      data: { unit: 'пары' },
    });
    const [issued] = await env.issues.createRegular(request, env.adminActor);
    assert.equal(issued.ppeItemId, replacement.id);
    assert.equal(issued.normItemPpeItemId, f.ppe.id);
  });

  test('integer and fractional millilitre quantities are issued as one full portion', async () => {
    for (const quantity of [300, 300.5]) {
      const f = await env.issueFixture({ type: 'OTHER', unit: 'мл', quantity });
      const plan = await env.issues.plan(f.employee.id, env.date());
      assert.equal(plan.items[0].totalPortions, 1);
      assert.equal(plan.items[0].available.quantity, quantity);
      const [issued] = await env.issues.createRegular(
        f.request,
        env.adminActor,
      );
      assert.equal(issued.quantity, quantity);
      assert.equal(issued.unit, 'мл');
      const fulfilled = await env.issues.plan(f.employee.id, env.date());
      assert.equal(fulfilled.items[0].available, null);
    }
  });

  test('replacing a size grid keeps IDs, activates selected sizes and deactivates omitted sizes', async () => {
    const f = await env.issueFixture();
    const [issued] = await env.issues.createRegular(f.request, env.adminActor);
    const sizes = await env.catalog.replaceSizes(
      f.ppe.id,
      { sizes: [{ value: '42' }, { value: '40' }, { value: '44' }] },
      env.actor,
    );
    assert.equal(sizes.find((s) => s.value === '42').id, f.sizes[0].id);
    assert.equal(sizes.find((s) => s.value === '43').isActive, false);
    assert.equal(sizes.find((s) => s.value === '40').isActive, true);
    assert.equal(sizes.find((s) => s.value === '44').isActive, true);
    assert.equal((await env.issues.findOne(issued.id)).sizeValue, '42');
    await env.catalog.replaceSizes(f.ppe.id, { sizes: [] }, env.actor);
    assert.equal(
      await env.prisma.ppeItemSize.count({
        where: { ppeItemId: f.ppe.id, isActive: true },
      }),
      0,
    );
  });

  test('a failed grid replacement rolls back new sizes, status changes and audit records', async () => {
    const f = await env.issueFixture();
    const before = await env.prisma.ppeItemSize.findMany({
      where: { ppeItemId: f.ppe.id },
      orderBy: { id: 'asc' },
    });
    const auditBefore = await env.prisma.auditLog.count();
    const audit = new env.PpeAuditService(new env.AuditLogService(env.prisma));
    let calls = 0;
    const failingAudit = {
      async writeChanges(data) {
        await audit.writeChanges(data);
        if (++calls === 2) throw new Error('injected grid failure');
      },
    };
    const catalog = new PpeCatalogService(
      env.prisma,
      failingAudit,
      new PpeCatalogSizesService(env.prisma, failingAudit),
    );
    await assert.rejects(
      catalog.replaceSizes(
        f.ppe.id,
        { sizes: [{ value: '42' }, { value: '45' }] },
        env.actor,
      ),
      /injected grid failure/,
    );
    assert.deepEqual(
      await env.prisma.ppeItemSize.findMany({
        where: { ppeItemId: f.ppe.id },
        orderBy: { id: 'asc' },
      }),
      before,
    );
    assert.equal(await env.prisma.auditLog.count(), auditBefore);
    await assert.rejects(
      async () =>
        env.catalog.replaceSizes(
          f.ppe.id,
          { sizes: [{ value: '42' }, { value: '42' }] },
          env.actor,
        ),
      env.errorCode('PPE_ITEM_SIZE_CONFLICT'),
    );
  });
}
