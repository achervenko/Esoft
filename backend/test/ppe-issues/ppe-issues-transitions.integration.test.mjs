import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const on = env.day();
  const oldDate = env.day(-5);
  const oldExpiry = env.date(-5);
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
              periodCount: 6,
              periodUnit: 'MONTH',
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
        assert.equal(row.plannedDate, on);
        assert.equal(row.availableFrom, oldDate);
        assert.equal(row.available.quantity, 2);
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
        assert.equal(created.quantity, 2);
        assert.equal(created.scheduledAt, on);
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
          2,
        );
      }
    });
}
