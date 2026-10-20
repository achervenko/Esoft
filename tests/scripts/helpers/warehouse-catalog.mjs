import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function verifyWarehouseCatalog(prisma, actor) {
  const { WarehouseCatalogService } = require('../../../backend/dist/src/warehouse/catalog/catalog.service.js');
  const { AuditLogService } = require('../../../backend/dist/src/audit/audit-log.service.js');
  const audit = new AuditLogService(prisma);
  const service = new WarehouseCatalogService(prisma, audit);
  const create = (article, extra = {}) => service.create({ article, name: 'Подшипник', unit: 'шт', ...extra }, actor.id);
  const first = await create('CAT-1', { comment: ' Для редуктора ' });
  assert.equal(typeof first.id, 'string');
  assert.equal(first.comment, 'Для редуктора');
  assert.equal(first.isActive, true);
  assert.equal(Object.hasOwn(first, 'externalId'), false);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.deepEqual(await service.findOne(first.id), first);
  const createAudit = await prisma.auditLog.findMany({ where: { entityType: 'warehouse_item', entityStringId: first.id } });
  assert.equal(createAudit.length, 5);
  assert.ok(createAudit.every((row) => row.module === 'WAREHOUSE' && row.action === 'CREATE' && row.userId === actor.id && row.entityId === null));
  await assert.rejects(create('CAT-1'), (error) => error.response?.code === 'WAREHOUSE_ARTICLE_EXISTS');
  assert.equal(await prisma.auditLog.count({ where: { entityStringId: first.id, entityType: 'warehouse_item' } }), 5);
  assert.deepEqual(await service.update(first.id, { name: 'Подшипник' }, actor.id), first);
  assert.equal(await prisma.auditLog.count({ where: { entityStringId: first.id, entityType: 'warehouse_item' } }), 5);
  const updated = await service.update(first.id, { name: 'Новое имя', comment: null, unit: 'м' }, actor.id);
  assert.equal(updated.article, 'CAT-1');
  assert.equal(updated.comment, null);
  assert.equal(updated.unit, 'м');
  assert.equal(updated.id, first.id);
  const changedFields = await prisma.auditLog.findMany({ where: { entityStringId: first.id, action: 'UPDATE', entityType: 'warehouse_item' } });
  assert.equal(changedFields.length, 3);

  const second = await create('CAT-2');
  await assert.rejects(service.update(first.id, { article: second.article }, actor.id), (error) => error.response?.code === 'WAREHOUSE_ARTICLE_EXISTS');
  assert.equal((await service.findOne(first.id)).article, 'CAT-1');
  assert.equal((await service.setStatus(first.id, { isActive: false }, actor.id)).isActive, false);
  const auditCount = await prisma.auditLog.count({ where: { entityStringId: first.id, entityType: 'warehouse_item' } });
  await service.setStatus(first.id, { isActive: false }, actor.id);
  assert.equal(await prisma.auditLog.count({ where: { entityStringId: first.id, entityType: 'warehouse_item' } }), auditCount);
  assert.equal((await service.findOne(first.id)).isActive, false);
  assert.equal((await service.list({ isActive: 'false' })).items[0].id, first.id);
  assert.ok((await service.list({ isActive: 'true' })).items.every((item) => item.id !== first.id));
  await service.setStatus(first.id, { isActive: true }, actor.id);

  const location = await prisma.warehouseStorageLocation.create({ data: { code: 'CAT-LOCATION', name: 'Shelf' } });
  const balance = await prisma.warehouseBalance.create({ data: { itemId: BigInt(first.id), storageLocationId: location.id, quantity: '2' } });
  const project = await prisma.warehouseProject.create({ data: { projectNumber: 'CAT-PROJECT' } });
  const reservation = await prisma.warehouseProjectReservation.create({ data: { balanceId: balance.id, projectId: project.id, quantity: '1' } });
  await assert.rejects(service.update(first.id, { unit: 'кг', name: 'Must not persist' }, actor.id), (error) => error.response?.code === 'WAREHOUSE_UNIT_IN_USE');
  assert.equal((await service.findOne(first.id)).name, 'Новое имя');
  await service.update(first.id, { unit: 'м', comment: 'Used item' }, actor.id);
  await service.setStatus(first.id, { isActive: false }, actor.id);
  assert.equal((await prisma.warehouseBalance.findUniqueOrThrow({ where: { id: balance.id } })).quantity.toString(), '2');
  assert.equal((await prisma.warehouseProjectReservation.findUniqueOrThrow({ where: { id: reservation.id } })).balanceId, balance.id);

  const sheet = await prisma.warehouseIssueSheet.create({ data: { name: 'Catalog reference', status: 'draft', createdByUserId: actor.id } });
  await prisma.warehouseIssueSheetLine.create({ data: { issueSheetId: sheet.id, itemId: BigInt(second.id), quantity: '1', matchingStatus: 'matched', rowNumber: 1, unitSnapshot: 'шт' } });
  await assert.rejects(service.update(second.id, { unit: 'кг' }, actor.id), (error) => error.response?.code === 'WAREHOUSE_UNIT_IN_USE');

  const huge = await prisma.warehouseItem.create({ data: { id: 9007199254740993n, article: 'CAT-HUGE', name: 'Large ID', unit: 'шт' } });
  assert.equal((await service.findOne(huge.id.toString())).id, '9007199254740993');
  assert.equal((await service.update(huge.id.toString(), { comment: 'Exact ID' }, actor.id)).id, '9007199254740993');
  assert.equal((await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'warehouse_item', entityStringId: huge.id.toString() } })).entityId, null);

  const literal = await create('CAT-%_literal', { name: 'Literal search' });
  assert.deepEqual((await service.list({ q: '%_' })).items.map((item) => item.id), [literal.id]);
  assert.deepEqual((await service.list({ q: 'пОдШиПнИк' })).items.map((item) => item.id), [second.id]);
  assert.deepEqual((await service.list({ q: 'used item' })).items.map((item) => item.id), [first.id]);
  const page = await service.list({ q: 'CAT-', limit: '1', offset: '1' });
  assert.equal(page.items.length, 1);
  assert.equal(page.total, 4);
  assert.deepEqual(page.items, (await service.list({ q: 'CAT-' })).items.slice(1, 2));

  const racing = await Promise.allSettled([create('CAT-RACE'), create('CAT-RACE')]);
  assert.equal(racing.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(racing.find((result) => result.status === 'rejected').reason.response.code, 'WAREHOUSE_ARTICLE_EXISTS');
  assert.equal(await prisma.warehouseItem.count({ where: { article: 'CAT-RACE' } }), 1);

  const failedAudit = new WarehouseCatalogService(prisma, { async writeFieldChanges() { throw new Error('Injected audit failure'); } });
  await assert.rejects(failedAudit.create({ article: 'CAT-ROLLBACK', name: 'Rollback', unit: 'шт' }, actor.id), /Injected audit failure/);
  assert.equal(await prisma.warehouseItem.count({ where: { article: 'CAT-ROLLBACK' } }), 0);
  await assert.rejects(failedAudit.update(second.id, { name: 'Rollback update' }, actor.id), /Injected audit failure/);
  assert.equal((await service.findOne(second.id)).name, 'Подшипник');
  await assert.rejects(failedAudit.setStatus(second.id, { isActive: false }, actor.id), /Injected audit failure/);
  assert.equal((await service.findOne(second.id)).isActive, true);
  for (const action of [() => service.findOne('9223372036854775807'), () => service.update('9223372036854775807', { name: 'Missing' }, actor.id), () => service.setStatus('9223372036854775807', { isActive: false }, actor.id)])
    await assert.rejects(action(), (error) => error.response?.code === 'WAREHOUSE_ITEM_NOT_FOUND');
  await assert.rejects(service.create({ article: 'BAD', name: 'Item', unit: 'шт', externalId: 'not-supported' }, actor.id), (error) => error.response?.code === 'UNKNOWN_FIELDS');

  // An audit unique conflict must propagate unchanged, rolling back the item.
  const existingAudit = await prisma.auditLog.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const auditCountBefore = await prisma.auditLog.count();
  let auditConflict;
  const conflictingAudit = new WarehouseCatalogService(prisma, {
    async writeFieldChanges({ tx }) {
      try {
        await tx.auditLog.create({ data: {
          id: existingAudit.id, userId: actor.id, module: 'WAREHOUSE', action: 'CREATE', entityType: 'warehouse_item',
        } });
      } catch (error) { auditConflict = error; throw error; }
    },
  });
  await assert.rejects(
    conflictingAudit.create({ article: 'CAT-AUDIT-UNIQUE', name: 'Rollback', unit: 'шт' }, actor.id),
    (error) => {
      assert.equal(error, auditConflict);
      assert.equal(error.code, 'P2002');
      assert.equal(error.meta?.modelName, 'AuditLog');
      assert.notEqual(error.response?.code, 'WAREHOUSE_ARTICLE_EXISTS');
      return true;
    },
  );
  assert.equal(await prisma.warehouseItem.count({ where: { article: 'CAT-AUDIT-UNIQUE' } }), 0);
  assert.equal(await prisma.auditLog.count(), auditCountBefore);
}
