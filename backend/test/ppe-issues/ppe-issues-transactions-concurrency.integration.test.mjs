import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  runPpeIssueTransaction,
} = require('../../dist/src/ppe/ppe-issues.transaction.js');
const {
  PpeIssuesGuardsService,
} = require('../../dist/src/ppe/ppe-issues-guards.service.js');

export function registerTests(env) {
  const {
    prisma,
    issues,
    issueFixture,
    specialist,
    actor,
    errorCode,
    createIssuesService,
    injectingClient,
    testUrl,
    admin,
    databaseName,
  } = env;
  async function issueCount(employeeId) {
    return prisma.ppeIssue.count({ where: { employeeId } });
  }
  test('database constraints protect regular obligation uniqueness and regular/extra/cancellation invariants', async () => {
    const f = await issueFixture();
    const [issue] = await issues.createRegular(f.request, specialist);
    const original = await prisma.ppeIssue.findUnique({
      where: { id: issue.id },
    });
    const { id: originalId, ...data } = original;
    assert.equal(originalId, issue.id);
    await assert.rejects(
      prisma.ppeIssue.create({ data }),
      (error) => error.code === 'P2002',
    );
    await assert.rejects(
      runPpeIssueTransaction(prisma, new PpeIssuesGuardsService(), (tx) =>
        tx.ppeIssue.create({ data }),
      ),
      errorCode('PPE_NORM_ALREADY_ISSUED'),
    );
    await assert.rejects(
      runPpeIssueTransaction(prisma, new PpeIssuesGuardsService(), (tx) =>
        tx.ppeItem.create({
          data: {
            article: f.ppe.article,
            name: 'Duplicate',
            unit: 'пары',
            type: 'FEET',
          },
        }),
      ),
      (error) => error.code === 'P2002',
    );
    await assert.rejects(
      prisma.ppeIssue.create({
        data: { ...data, normItemId: null },
      }),
    );
    await assert.rejects(
      prisma.ppeIssue.create({ data: { ...data, issueType: 'EXTRA' } }),
    );
    await assert.rejects(
      prisma.ppeIssue.update({
        where: { id: issue.id },
        data: { status: 'CANCELLED' },
      }),
    );
    assert.equal(await issueCount(f.employee.id), 1);
    assert.equal((await issues.findOne(issue.id)).status, 'ISSUED');
  });
  test('error in a later batch row rolls back earlier issues and audit', async () => {
    const f = await issueFixture({ multiple: true });
    const logs = await prisma.auditLog.count();
    const request = {
      employeeId: f.employee.id,
      items: [
        f.request.items[0],
        { normItemId: 2147483647, ppeItemId: f.items[1].id },
      ],
    };
    await assert.rejects(
      issues.createRegular(request, specialist),
      errorCode('PPE_NORM_ITEM_NOT_FOUND'),
    );
    assert.equal(await issueCount(f.employee.id), 0);
    assert.equal(await prisma.auditLog.count(), logs);
  });
  test('database failure on second batch insert rolls back both issues and audit', async () => {
    const f = await issueFixture({ multiple: true });
    let created = 0;
    const faulty = injectingClient((tx) => ({
      ...tx,
      ppeIssue: {
        ...tx.ppeIssue,
        create: (args) => {
          if (++created === 2) throw new Error('second issue failed');
          return tx.ppeIssue.create(args);
        },
      },
    }));
    const service = createIssuesService(faulty);
    const logs = await prisma.auditLog.count();
    await assert.rejects(
      service.createRegular(
        {
          employeeId: f.employee.id,
          items: f.norm.items.map((item) => ({
            normItemId: item.id,
            ppeItemId: item.ppeItemId,
          })),
        },
        specialist,
      ),
      /second issue failed/,
    );
    assert.equal(await issueCount(f.employee.id), 0);
    assert.equal(await prisma.auditLog.count(), logs);
  });
  test('audit failure rolls back issue creation and cancellation', async () => {
    const f = await issueFixture();
    const fail = () => {
      throw new Error('audit failed');
    };
    const failing = createIssuesService(prisma, {
      created: fail,
      cancelled: fail,
    });
    await assert.rejects(
      failing.createRegular(f.request, specialist),
      /audit failed/,
    );
    await assert.rejects(
      failing.createExtra(
        {
          employeeId: f.employee.id,
          items: [{ ppeItemId: f.items[2].id, quantity: 1 }],
        },
        specialist,
      ),
      /audit failed/,
    );
    assert.equal(await issueCount(f.employee.id), 0);
    const [created] = await issues.createRegular(f.request, specialist);
    const original = await issues.findOne(created.id);
    const logs = await prisma.auditLog.count();
    await assert.rejects(
      failing.cancel(original.id, { reason: 'wrong' }, actor),
      /audit failed/,
    );
    assert.deepEqual(await issues.findOne(original.id), original);
    assert.equal(await prisma.auditLog.count(), logs);
  });
  test('two parallel regular requests wait on the employee lock and cannot close one obligation twice', async () => {
    const f = await issueFixture({ quantity: 1 });
    const blocker = new pg.Client({ connectionString: testUrl.toString() });
    let pending;
    let waiting = 0;
    try {
      await blocker.connect();
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM employees WHERE id=$1 FOR UPDATE', [
        f.employee.id,
      ]);
      pending = Promise.allSettled([
        issues.createRegular(f.request, specialist),
        issues.createRegular(f.request, specialist),
      ]);
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const result = await admin.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%employees%'",
          [databaseName],
        );
        waiting = result.rows[0].count;
        if (waiting === 2) break;
        await delay(20);
      }
    } finally {
      await blocker.query('ROLLBACK');
      await blocker.end();
    }
    const results = await pending;
    assert.equal(waiting, 2);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.find((result) => result.status === 'rejected').reason.response
        .code,
      'PPE_NORM_NOT_DUE',
    );
    assert.equal(await issueCount(f.employee.id), 1);
  });
  test('concurrent cancellation cannot audit or cancel the same issue twice', async () => {
    const f = await issueFixture();
    const [issue] = await issues.createRegular(f.request, specialist);
    const results = await Promise.allSettled([
      issues.cancel(issue.id, { reason: 'wrong' }, actor),
      issues.cancel(issue.id, { reason: 'wrong again' }, actor),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.find((result) => result.status === 'rejected').reason.response
        .code,
      'PPE_ISSUE_ALREADY_CANCELLED',
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: 'ppe_issue',
          entityId: issue.id,
          action: 'STATUS_CHANGE',
        },
      }),
      2,
    );
  });
}
