import assert from 'node:assert/strict';
import { test } from 'node:test';

export function registerTests(env) {
  const {
    fixture,
    service,
    prisma,
    actor,
    day,
    counts,
    injectingClient,
    createNormsService,
    PpeAuditService,
    AuditLogService,
  } = env;
  test('failure on second item rolls back the norm, first item and audit', async () => {
    const f = await fixture();
    const logCount = await prisma.auditLog.count();
    let created = 0;
    const faulty = injectingClient((tx) => ({
      ...tx,
      ppeNormItem: {
        ...tx.ppeNormItem,
        create: (args) => {
          if (++created === 2) throw new Error('second item failed');
          return tx.ppeNormItem.create(args);
        },
      },
    }));
    const failingService = createNormsService(
      faulty,
      new PpeAuditService(new AuditLogService(prisma)),
    );
    await assert.rejects(
      failingService.create(f.payload, actor),
      /second item failed/,
    );
    assert.deepEqual(await counts(f.position.id), { norms: 0, items: 0 });
    assert.equal(await prisma.auditLog.count(), logCount);
  });

  test('audit failure rolls back creation and the closing of a previous revision', async () => {
    const f = await fixture();
    const failingAudit = new PpeAuditService({
      writeFieldChanges: () => {
        throw new Error('audit failed');
      },
    });
    const failingService = createNormsService(prisma, failingAudit);
    await assert.rejects(
      failingService.create(f.payload, actor),
      /audit failed/,
    );
    assert.deepEqual(await counts(f.position.id), { norms: 0, items: 0 });
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const logCount = await prisma.auditLog.count();
    await assert.rejects(
      failingService.createRevision(
        old.id,
        { effectiveFrom: day(10), items: f.rows },
        actor,
      ),
      /audit failed/,
    );
    assert.deepEqual(await service.findOne(old.id), old);
    assert.equal(await prisma.auditLog.count(), logCount);
  });

  test('future composition changes roll back when audit fails', async () => {
    const f = await fixture();
    const norm = await service.create(f.payload, actor);
    const failingService = createNormsService(
      prisma,
      new PpeAuditService({
        writeFieldChanges: () => {
          throw new Error('audit failed');
        },
      }),
    );
    await assert.rejects(
      failingService.updateFuture(
        norm.id,
        { effectiveFrom: day(11), items: [f.rows[0]] },
        actor,
      ),
      /audit failed/,
    );
    assert.deepEqual(await service.findOne(norm.id), norm);
  });

  test('moving a revision rolls back both boundaries and all audits on failure', async () => {
    const f = await fixture();
    const old = await service.create(
      { ...f.payload, effectiveFrom: day(-10) },
      actor,
    );
    const future = await service.createRevision(
      old.id,
      { effectiveFrom: day(10), items: f.rows },
      actor,
    );
    const before = await service.list(f.position.id);
    const logCount = await prisma.auditLog.count();
    const failingService = createNormsService(
      prisma,
      new PpeAuditService({
        writeFieldChanges: () => {
          throw new Error('audit failed');
        },
      }),
    );
    for (const offset of [5, 20]) {
      await assert.rejects(
        failingService.updateFuture(
          future.id,
          {
            effectiveFrom: day(offset),
            items: f.rows,
          },
          actor,
        ),
        /audit failed/,
      );
      assert.deepEqual(await service.list(f.position.id), before);
      assert.equal(await prisma.auditLog.count(), logCount);
    }
  });
}
