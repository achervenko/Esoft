import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const on = env.day();
  const oldDate = env.day(-240);
  const oldExpiry = env.date(-240);
  const expiryYear = oldExpiry.getUTCFullYear() + 1;
  const expiryMonth = oldExpiry.getUTCMonth();
  const expiryDay = Math.min(
    oldExpiry.getUTCDate(),
    new Date(Date.UTC(expiryYear, expiryMonth + 1, 0)).getUTCDate(),
  );
  const softExpiry = new Date(Date.UTC(expiryYear, expiryMonth, expiryDay))
    .toISOString()
    .slice(0, 10);
  const request = (f, revision) => ({
    employeeId: f.employee.id,
    issuedAt: on,
    items: [{ normItemId: revision.items[0].id, ppeItemId: f.ppe.id }],
  });
  for (const mode of ['SOFT', 'HARD'])
    test(`${mode} revision shares its wear calculation between plan and POST`, async () => {
      const f = await env.issueFixture({ from: oldDate, quantity: 1 });
      await env.issues.createRegular(
        { ...f.request, issuedAt: oldDate },
        env.adminActor,
      );
      const revision = await env.service.createRevision(
        f.norm.id,
        {
          effectiveFrom: on,
          effectiveTo: null,
          transitionMode: mode,
          items: [
            {
              ppeItemId: f.ppe.id,
              quantity: 2,
              periodCount: 1,
              periodUnit: 'YEAR',
              calculationMode: 'INTERVAL',
            },
          ],
        },
        env.actor,
      );
      assert.equal(revision.transitionMode, mode);
      assert.equal(
        (await env.prisma.ppeNorm.findUnique({ where: { id: revision.id } }))
          .previousNormId,
        f.norm.id,
      );
      const row = (await env.issues.plan(f.employee.id, env.date())).items[0];
      if (mode === 'SOFT') {
        assert.equal(row.available, null);
        assert.equal(row.nextFuture.scheduledAt, softExpiry);
        await assert.rejects(
          env.issues.createRegular(request(f, revision), env.adminActor),
          env.errorCode('PPE_NORM_NOT_DUE'),
        );
      } else {
        assert.equal(row.available.quantity, 1);
        const results = await Promise.allSettled([
          env.issues.createRegular(request(f, revision), env.adminActor),
          env.issues.createRegular(request(f, revision), env.adminActor),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const created = results.find((result) => result.status === 'fulfilled')
          .value[0];
        assert.equal(created.quantity, 1);
        assert.equal(
          (await env.issues.plan(f.employee.id, env.date())).items[0].available,
          null,
        );
        await env.issues.cancel(
          created.id,
          { reason: 'Transition cancellation test' },
          env.actor,
        );
        assert.equal(
          (await env.issues.plan(f.employee.id, env.date())).items[0].available
            .quantity,
          1,
        );
      }
    });
  test(
    'monthly hard transition tops up the current month and creates no old yearly debt',
    {
      skip: on.endsWith('-01')
        ? 'No earlier issue in the transition month exists on its first day'
        : false,
    },
    async () => {
      const monthStart = `${on.slice(0, 7)}-01`;
      const f = await env.issueFixture({ from: monthStart, quantity: 60 });
      await env.prisma.ppeNormItem.update({
        where: { id: f.norm.items[0].id },
        data: { calculationMode: 'MONTHLY' },
      });
      const [old] = await env.issues.createRegular(
        { ...f.request, issuedAt: monthStart },
        env.adminActor,
      );
      assert.equal(old.quantity, 5);
      const revision = await env.service.createRevision(
        f.norm.id,
        {
          effectiveFrom: on,
          effectiveTo: null,
          transitionMode: 'HARD',
          items: [
            {
              ppeItemId: f.ppe.id,
              quantity: 120,
              periodCount: 1,
              periodUnit: 'YEAR',
              calculationMode: 'MONTHLY',
            },
          ],
        },
        env.actor,
      );
      const row = (await env.issues.plan(f.employee.id, env.date())).items[0];
      assert.equal(row.available.quantity, 5);
      assert.equal(row.dueUnissued, 1);
      const [topup] = await env.issues.createRegular(
        request(f, revision),
        env.adminActor,
      );
      assert.equal(topup.quantity, 5);
      assert.equal(
        (await env.issues.plan(f.employee.id, env.date())).items[0].available,
        null,
      );
      await assert.rejects(
        env.issues.createRegular(request(f, revision), env.adminActor),
        env.errorCode('PPE_NORM_NOT_DUE'),
      );
      await env.issues.cancel(
        topup.id,
        { reason: 'Top-up cancellation test' },
        env.actor,
      );
      assert.equal(
        (await env.issues.plan(f.employee.id, env.date())).items[0].available
          .quantity,
        5,
      );
      await env.issues.createRegular(request(f, revision), env.adminActor);
      await env.issues.cancel(
        old.id,
        { reason: 'Cancel old credited volume' },
        env.actor,
      );
      const afterOldCancellation = (
        await env.issues.plan(f.employee.id, env.date())
      ).items[0];
      assert.equal(afterOldCancellation.available.quantity, 5);
      assert.equal(afterOldCancellation.available.scheduledPortion, 1);
      const [secondTopup] = await env.issues.createRegular(
        request(f, revision),
        env.adminActor,
      );
      assert.equal(secondTopup.quantity, 5);
      assert.equal(
        (await env.issues.plan(f.employee.id, env.date())).items[0].available,
        null,
      );
    },
  );
}
