import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { setTimeout as delay } from 'node:timers/promises';

export function registerTests(env) {
  const { fixture, service, actor, day, counts, testUrl, admin, databaseName } =
    env;
  test('concurrent overlapping creates cannot both commit', async () => {
    const f = await fixture();
    const blocker = new pg.Client({ connectionString: testUrl.toString() });
    let pending;
    let blocked = 0;
    try {
      await blocker.connect();
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM positions WHERE id=$1 FOR UPDATE', [
        f.position.id,
      ]);
      pending = Promise.allSettled([
        service.create(f.payload, actor),
        service.create({ ...f.payload, effectiveFrom: day(11) }, actor),
      ]);
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const waiting = await admin.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%positions%'",
          [databaseName],
        );
        blocked = waiting.rows[0].count;
        if (blocked === 2) break;
        await delay(20);
      }
    } finally {
      await blocker.query('ROLLBACK');
      await blocker.end();
    }
    const results = await pending;
    assert.equal(
      blocked,
      2,
      'both transactions must wait on the position lock before proceeding',
    );
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const failure = results.find((result) => result.status === 'rejected');
    assert.equal(failure.reason.response.code, 'PPE_NORM_PERIOD_CONFLICT');
    assert.deepEqual(await counts(f.position.id), { norms: 1, items: 2 });
  });

  test('concurrent revisions serialize: one succeeds, other conflicts, original items stay unchanged', async () => {
    const f = await fixture();
    const norm = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const results = await Promise.allSettled([
      service.createRevision(
        norm.id,
        { effectiveFrom: day(10), items: f.rows },
        actor,
      ),
      service.createRevision(
        norm.id,
        { effectiveFrom: day(11), items: f.rows },
        actor,
      ),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.find((result) => result.status === 'rejected').reason.response
        .code,
      'PPE_NORM_PERIOD_CONFLICT',
    );
    assert.equal((await counts(f.position.id)).norms, 2);
    assert.deepEqual((await service.findOne(norm.id)).items, norm.items);
  });
}
