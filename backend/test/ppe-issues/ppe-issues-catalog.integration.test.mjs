import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  test('BODY catalog requires a size-height pair and selects and snapshots the actual pair', async () => {
    const f = await env.issueFixture({ type: 'BODY' });
    await assert.rejects(
      env.catalog.updateItem(
        f.ppe.id,
        {
          article: f.ppe.article,
          name: f.ppe.name,
          unit: f.ppe.unit,
          type: 'FEET',
        },
        env.actor,
      ),
      env.errorCode('PPE_SIZE_TYPE_CONFLICT'),
    );
    await assert.rejects(
      env.catalog.createSize(f.ppe.id, { value: '88–92' }, env.actor),
      env.errorCode('PPE_HEIGHT_REQUIRED'),
    );
    const alternate = await env.catalog.createSize(
      f.ppe.id,
      { value: '88–92', heightValue: '170–176' },
      env.actor,
    );
    await assert.rejects(
      env.catalog.createSize(
        f.ppe.id,
        { value: '88–92', heightValue: '170–176' },
        env.actor,
      ),
      env.errorCode('PPE_ITEM_SIZE_CONFLICT'),
    );
    await assert.rejects(
      env.catalog.updateSize(
        f.ppe.id,
        alternate.id,
        { value: '88–92' },
        env.actor,
      ),
      env.errorCode('PPE_HEIGHT_REQUIRED'),
    );
    const plan = await env.issues.plan(f.employee.id, env.date());
    assert.equal(plan.items[0].sizes.recommendedSizeId, f.sizes[0].id);
    assert.equal(plan.items[0].sizes.recommendedHeightValue, '158–164');
    assert.ok(
      plan.items[0].sizes.activeSizes.some(
        (size) => size.id === alternate.id && size.heightValue === '170–176',
      ),
    );
    const [issue] = await env.issues.createRegular(
      {
        ...f.request,
        items: [{ ...f.request.items[0], sizeId: alternate.id }],
      },
      env.specialist,
    );
    assert.equal(issue.sizeValue, '88–92');
    assert.equal(issue.heightValue, '170–176');
    assert.equal(issue.warnings[0].code, 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED');
    await env.prisma.employee.update({
      where: { id: f.employee.id },
      data: { ppeSizes: { update: { clothingHeight: '182–188' } } },
    });
    await env.catalog.updateSize(
      f.ppe.id,
      alternate.id,
      { value: '88–92', heightValue: '194–200' },
      env.actor,
    );
    assert.equal(
      (await env.issues.findOne(issue.id)).heightValue,
      '170–176',
    );
    const noMatch = await env.issueFixture({ type: 'BODY' });
    await env.prisma.employee.update({
      where: { id: noMatch.employee.id },
      data: { ppeSizes: { update: { clothingHeight: '182–188' } } },
    });
    await assert.rejects(
      env.issues.createRegular(noMatch.request, env.specialist),
      env.errorCode('PPE_SIZE_REQUIRED'),
    );
    const shoes = await env.issueFixture();
    await assert.rejects(
      env.catalog.updateItem(
        shoes.ppe.id,
        {
          article: shoes.ppe.article,
          name: shoes.ppe.name,
          unit: shoes.ppe.unit,
          type: 'BODY',
        },
        env.actor,
      ),
      env.errorCode('PPE_SIZE_TYPE_CONFLICT'),
    );
    await assert.rejects(
      env.catalog.createSize(
        shoes.ppe.id,
        { value: '44', heightValue: '158–164' },
        env.actor,
      ),
      env.errorCode('PPE_HEIGHT_NOT_ALLOWED'),
    );
    const created = await env.catalog.createSize(
      shoes.ppe.id,
      { value: '44' },
      env.actor,
    );
    await assert.rejects(
      env.catalog.createSize(shoes.ppe.id, { value: '44' }, env.actor),
      env.errorCode('PPE_ITEM_SIZE_CONFLICT'),
    );
    assert.equal(created.heightValue, null);
  });
  test('OTHER rejects sizes and changing to OTHER counts inactive sizes too', async () => {
    const other = await env.issueFixture({ type: 'OTHER' });
    await assert.rejects(
      env.catalog.createSize(other.ppe.id, { value: '42' }, env.actor),
      env.errorCode('PPE_ITEM_SIZES_NOT_ALLOWED'),
    );
    assert.equal(
      await env.prisma.ppeItemSize.count({
        where: { ppeItemId: other.ppe.id },
      }),
      0,
    );
    const f = await env.issueFixture();
    const payload = {
      article: f.ppe.article,
      name: f.ppe.name,
      unit: f.ppe.unit,
      type: 'OTHER',
    };
    await assert.rejects(
      env.catalog.updateItem(f.ppe.id, payload, env.actor),
      env.errorCode('PPE_ITEM_HAS_SIZES'),
    );
    await env.prisma.ppeItemSize.updateMany({
      where: { ppeItemId: f.ppe.id },
      data: { isActive: false },
    });
    await assert.rejects(
      env.catalog.updateItem(f.ppe.id, payload, env.actor),
      env.errorCode('PPE_ITEM_HAS_SIZES'),
    );
    assert.equal((await env.catalog.findItem(f.ppe.id)).type, 'FEET');
    assert.equal(
      await env.prisma.auditLog.count({
        where: { entityType: 'ppe_item', entityId: f.ppe.id },
      }),
      0,
    );
  });
  test('catalog requires type, returns all types, audits changes and locks type after cancelled history', async () => {
    for (const type of ['HANDS', 'FEET', 'BODY', 'TSHIRT', 'HEAD', 'OTHER']) {
      const created = await env.catalog.createItem(
        { article: `type-${type}`, name: type, unit: 'шт', type },
        env.actor,
      );
      assert.equal((await env.catalog.findItem(created.id)).type, type);
      const changed = await env.catalog.updateItem(
        created.id,
        {
          article: created.article,
          name: created.name,
          unit: created.unit,
          type: type === 'OTHER' ? 'BODY' : 'OTHER',
        },
        env.actor,
      );
      assert.notEqual(changed.type, type);
      const audit = await env.prisma.auditLog.findMany({
        where: { entityType: 'ppe_item', entityId: created.id },
      });
      assert.ok(audit.some((row) => row.fieldName === 'Тип СИЗ'));
    }
    const f = await env.issueFixture();
    const [issue] = await env.issues.createRegular(f.request, env.specialist);
    await env.issues.cancel(issue.id, { reason: 'Test' }, env.actor);
    await assert.rejects(
      env.catalog.updateItem(
        f.ppe.id,
        {
          article: f.ppe.article,
          name: f.ppe.name,
          unit: f.ppe.unit,
          type: 'OTHER',
        },
        env.actor,
      ),
      env.errorCode('PPE_ITEM_TYPE_IN_USE'),
    );
    assert.equal((await env.catalog.findItem(f.ppe.id)).hasActiveNorm, true);
    await env.catalog.updateItem(
      f.ppe.id,
      {
        article: f.ppe.article,
        name: 'Renamed',
        unit: f.ppe.unit,
        type: f.ppe.type,
      },
      env.actor,
    );
    assert.equal((await env.catalog.findItem(f.ppe.id)).name, 'Renamed');
    assert.equal(
      (await env.service.findOne(f.norm.id)).items[0].name,
      f.ppe.name,
    );
    const plan = await env.issues.plan(f.employee.id, env.date(0));
    assert.equal(plan.items[0].name, f.ppe.name);
    const revision = await env.service.createRevision(
      f.norm.id,
      {
        effectiveFrom: env.day(1),
        effectiveTo: null,
        items: [
          {
            ppeItemId: f.ppe.id,
            quantity: 2,
            periodCount: 1,
            periodUnit: 'YEAR',
          },
        ],
      },
      env.actor,
    );
    assert.equal(revision.items[0].name, 'Renamed');
    assert.equal(
      (await env.issues.findOne(issue.id)).ppeItemTypeSnapshot,
      'FEET',
    );
  });
}
