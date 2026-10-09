import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  test('recommends the actual replacement size independently of its norm and does not write history or audit', async () => {
    const f = await env.issueFixture({ type: 'BODY' });
    const replacement = await env.prisma.ppeItem.create({
      data: {
        article: `recommend-${f.employee.id}`,
        name: 'Ботинки для замены',
        unit: 'пары',
        type: 'FEET',
      },
    });
    const size = await env.prisma.ppeItemSize.create({
      data: { ppeItemId: replacement.id, value: '42.0' },
    });
    const before = await Promise.all([
      env.prisma.ppeIssue.count(),
      env.prisma.auditLog.count(),
    ]);
    const result = await env.issues.recommendSize(
      f.employee.id,
      replacement.id,
    );
    assert.equal(result.type, 'FEET');
    assert.equal(result.recommendedSizeId, size.id);
    assert.equal(result.recommendedHeightValue, null);
    assert.deepEqual(result.activeSizes, [
      { id: size.id, value: '42.0', heightValue: null },
    ]);
    assert.deepEqual(
      await Promise.all([
        env.prisma.ppeIssue.count(),
        env.prisma.auditLog.count(),
      ]),
      before,
    );
    await assert.rejects(
      env.issues.recommendSize(f.employee.id, 2147483647),
      env.errorCode('PPE_ITEM_NOT_FOUND'),
    );
  });
  test('plan requires intervention when all catalog sizes are inactive and issuance remains blocked', async () => {
    const f = await env.issueFixture({ type: 'BODY' });
    await env.prisma.ppeItemSize.updateMany({
      where: { ppeItemId: f.ppe.id },
      data: { isActive: false },
    });
    const plan = await env.issues.plan(f.employee.id, env.date());
    assert.deepEqual(plan.items[0].sizes.activeSizes, []);
    assert.equal(plan.items[0].sizes.recommendedSizeId, null);
    assert.equal(plan.items[0].sizes.requiresSelection, true);
    await assert.rejects(
      env.issues.createRegular(f.request, env.specialist),
      env.errorCode('PPE_SIZE_REQUIRED'),
    );
    await assert.rejects(
      env.issues.createRegular(
        {
          ...f.request,
          items: [{ ...f.request.items[0], sizeId: f.sizes[0].id }],
        },
        env.specialist,
      ),
      env.errorCode('PPE_SIZE_INACTIVE'),
    );
  });
  const { prisma, issues, issueFixture, specialist, date, errorCode } = env;
  for (const [type, value, height] of [
    ['FEET', '42', null],
    ['BODY', '88–92', '158–164'],
    ['HANDS', 'L', null],
    ['HEAD', '58', null],
  ]) {
    test(`recommends and snapshots employee size for ${type}`, async () => {
      const f = await issueFixture({ type });
      const plan = await issues.plan(f.employee.id, date());
      assert.equal(plan.items[0].sizes.recommendedSizeId, f.sizes[0].id);
      const [issue] = await issues.createRegular(f.request, specialist);
      assert.equal(issue.sizeValue, value);
      assert.equal(issue.clothingHeight, height);
      assert.equal(issue.ppeItemTypeSnapshot, type);
      assert.equal(plan.items[0].type, type);
      assert.deepEqual(issue.warnings, []);
    });
  }
  test('OTHER and a catalog without configured sizes use null size and height', async () => {
    const none = await issueFixture({ type: 'OTHER' });
    assert.equal(
      (await issues.createRegular(none.request, specialist))[0].sizeValue,
      null,
    );
    const clothing = await issueFixture({ type: 'BODY' });
    await prisma.ppeItemSize.deleteMany({
      where: { ppeItemId: clothing.ppe.id },
    });
    const [issue] = await issues.createRegular(clothing.request, specialist);
    assert.equal(issue.sizeValue, null);
    assert.equal(issue.clothingHeight, null);
  });
  test('OTHER replacement clears both size snapshots', async () => {
    const f = await issueFixture({ type: 'OTHER' });
    const other = await issueFixture({ type: 'OTHER' });
    const [issue] = await issues.createRegular(
      {
        ...f.request,
        items: [{ normItemId: f.norm.items[0].id, ppeItemId: other.ppe.id }],
      },
      specialist,
    );
    assert.equal(issue.ppeItemTypeSnapshot, 'OTHER');
    assert.equal(issue.sizeValue, null);
    assert.equal(issue.clothingHeight, null);
    assert.equal(
      await prisma.ppeIssue.count({ where: { ppeItemId: f.ppe.id } }),
      0,
    );
    await assert.rejects(
      env.catalog.updateItem(
        f.ppe.id,
        {
          article: f.ppe.article,
          name: f.ppe.name,
          unit: f.ppe.unit,
          type: 'BODY',
        },
        env.actor,
      ),
      errorCode('PPE_ITEM_TYPE_IN_USE'),
    );
  });
  test('unmatched or missing employee size requires explicit selection from active item sizes', async () => {
    const f = await issueFixture();
    await prisma.employee.update({
      where: { id: f.employee.id },
      data: { shoeSize: null },
    });
    const plan = await issues.plan(f.employee.id, date());
    assert.equal(plan.items[0].sizes.requiresSelection, true);
    await assert.rejects(
      issues.createRegular(f.request, specialist),
      errorCode('PPE_SIZE_REQUIRED'),
    );
    const [issue] = await issues.createRegular(
      {
        ...f.request,
        items: [{ ...f.request.items[0], sizeId: f.sizes[1].id }],
      },
      specialist,
    );
    assert.equal(issue.sizeValue, '43');
    assert.deepEqual(issue.warnings, []);
  });
  test('rejects inactive, missing or foreign size IDs rather than accepting arbitrary values', async () => {
    const f = await issueFixture();
    const other = await issueFixture();
    for (const [sizeId, code] of [
      [f.sizes[2].id, 'PPE_SIZE_INACTIVE'],
      [2147483647, 'PPE_SIZE_NOT_FOUND'],
      [other.sizes[0].id, 'PPE_SIZE_NOT_FOUND'],
    ]) {
      await assert.rejects(
        issues.createRegular(
          { ...f.request, items: [{ ...f.request.items[0], sizeId }] },
          specialist,
        ),
        errorCode(code),
      );
    }
    assert.equal(
      await prisma.ppeIssue.count({ where: { employeeId: f.employee.id } }),
      0,
    );
  });
  test('explicit active size overrides recommendation; equivalent numeric shoe size matches', async () => {
    const f = await issueFixture();
    await prisma.ppeItemSize.update({
      where: { id: f.sizes[0].id },
      data: { value: '42.0' },
    });
    assert.equal(
      (await issues.plan(f.employee.id, date())).items[0].sizes
        .recommendedSizeId,
      f.sizes[0].id,
    );
    assert.equal(
      (
        await issues.createRegular(
          {
            ...f.request,
            items: [{ ...f.request.items[0], sizeId: f.sizes[1].id }],
          },
          specialist,
        )
      )[0].sizeValue,
      '43',
    );
  });
  test('different active size warns without blocking REGULAR or EXTRA and preserves selected size', async () => {
    for (const type of ['HANDS', 'FEET', 'BODY', 'HEAD']) {
      const f = await issueFixture({ type });
      for (const regular of [true, false]) {
        const [issue] = await (regular
          ? issues.createRegular(
              {
                ...f.request,
                items: [{ ...f.request.items[0], sizeId: f.sizes[1].id }],
              },
              specialist,
            )
          : issues.createExtra(
              {
                employeeId: f.employee.id,
                items: [
                  { ppeItemId: f.ppe.id, quantity: 1, sizeId: f.sizes[1].id },
                ],
              },
              specialist,
            ));
        assert.deepEqual(issue.warnings, [
          {
            code: 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED',
            message:
              'Выбранный размер отличается от рекомендуемого размера сотрудника.',
          },
        ]);
        assert.equal(
          (await issues.findOne(issue.id)).sizeValue,
          f.sizes[1].value,
        );
        assert.equal(issue.clothingHeight, type === 'BODY' ? '158–164' : null);
      }
    }
  });
  test('numeric equivalent sizes do not warn; missing catalogue match requires selection and warns on mismatch', async () => {
    const f = await issueFixture();
    await prisma.ppeItemSize.update({
      where: { id: f.sizes[0].id },
      data: { value: '42.0' },
    });
    const [equivalent] = await issues.createRegular(f.request, specialist);
    assert.deepEqual(equivalent.warnings, []);
    const other = await issueFixture();
    await prisma.employee.update({
      where: { id: other.employee.id },
      data: { shoeSize: 44 },
    });
    await assert.rejects(
      issues.createRegular(other.request, specialist),
      errorCode('PPE_SIZE_REQUIRED'),
    );
    const [selected] = await issues.createRegular(
      {
        ...other.request,
        items: [{ ...other.request.items[0], sizeId: other.sizes[0].id }],
      },
      specialist,
    );
    assert.equal(selected.sizeValue, '42');
    assert.equal(
      selected.warnings[0].code,
      'PPE_SIZE_DIFFERS_FROM_RECOMMENDED',
    );
  });
}
