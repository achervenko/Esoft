import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, '../../../..');
const code = (expected) => (error) => { assert.equal(error.response?.code, expected); return true; };

test('administrative adjustments and generic staged storage are atomic and preserve project demand', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 120000,
}, async (t) => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const load = (path) => require(join(project, 'backend/dist/src', path));
  const { WarehouseStockService } = load('warehouse/stock/stock.service.js');
  const { WarehouseStockQueryService } = load('warehouse/stock/stock-query.service.js');
  const { WarehouseStockAdjustmentsService } = load('warehouse/adjustments/adjustments.service.js');
  const { ADJUSTMENT_OWNER } = load('warehouse/adjustments/adjustments.constants.js');
  const { WarehouseStockAdjustmentAccessService } = load('warehouse/adjustments/adjustment-access.service.js');
  const { WarehouseStockAdjustmentCommandService } = load('warehouse/adjustments/adjustment-command.service.js');
  const { WarehouseStockAdjustmentDocumentService } = load('warehouse/adjustments/adjustment-document.service.js');
  const { WarehouseStockAdjustmentQueryService } = load('warehouse/adjustments/adjustment-query.service.js');
  const { StorageStagedUploadService } = load('storage/storage-staged-upload.service.js');
  const { StorageFilePolicyService } = load('storage/storage-file-policy.service.js');
  const { StorageFileService } = load('storage/storage-file.service.js');
  const { StorageFilePrimaryService } = load('storage/storage-file-primary.service.js');
  const { StorageOwnerService } = load('storage/storage-owner.service.js');
  const { StorageOwnerLockService } = load('storage/storage-owner-lock.service.js');
  const { AuditLogService } = load('audit/audit-log.service.js');
  const env = await createIsolatedPostgres();
  try {
    const root = join(env.root, 'adjustments');
    await mkdir(join(root, 'backend/prisma'), { recursive: true });
    await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
    for (const id of ['core', 'warehouse']) await cp(join(project, 'backend/prisma/packages', id), join(root, 'backend/prisma/packages', id), { recursive: true });
    await writeFile(join(root, 'database-packages.json'), '{"modules":["warehouse"]}');
    await env.database('adjustments');
    const url = env.urlFor('adjustments');
    const deploy = await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'deploy', output: { log() {} } });
    assert.equal(deploy.ok, true, deploy.stdout + deploy.stderr);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const bytes = new Map();
    let failDelete = false;
    let failPut = false;
    let deletes = 0;
    const objects = {
      bucket: 'adjustments-test',
      async putObject({ key, body }) { bytes.set(key, Buffer.from(body)); if (failPut) throw new Error('Injected ambiguous upload failure'); return { bucket: this.bucket, key }; },
      async deleteObject(key, bucket) { assert.equal(bucket, this.bucket); deletes++; if (failDelete) throw new Error('Injected cleanup failure'); bytes.delete(key); },
      async getObject(key) { assert.ok(bytes.has(key)); return { body: Readable.from(bytes.get(key)), contentType: 'application/pdf', contentLength: bytes.get(key).length }; },
    };
    try {
      const admin = await prisma.user.create({ data: { id: 'adjust-admin', name: 'Admin', email: 'adjust-admin@test.invalid', role: 'admin,storekeeper' } });
      const keeper = await prisma.user.create({ data: { id: 'adjust-keeper', name: 'Keeper', email: 'adjust-keeper@test.invalid', role: 'storekeeper' } });
      const secondAdmin = await prisma.user.create({ data: { id: 'adjust-other', name: 'Admin', email: 'adjust-other@test.invalid', role: 'admin' } });
      await t.test('database rejects malformed storage owners even through direct SQL', async () => {
        const { Client } = require('pg');
        const client = new Client({ connectionString: url });
        await client.connect();
        try {
          for (const table of ['storage_files', 'storage_uploads']) {
            for (const column of ['owner_module', 'owner_entity_type']) {
              for (const value of ['', 'Warehouse', 'foo bar', 'bad/name']) {
                const owner = { owner_module: 'warehouse', owner_entity_type: 'stock_adjustment', [column]: value };
                const extraColumns = table === 'storage_files' ? 'owner_entity_id' : 'id, sha256';
                const extraValues = table === 'storage_files' ? "'125'" : "gen_random_uuid(), repeat('a', 64)";
                await assert.rejects(client.query(`INSERT INTO ${table}
                  (bucket, object_key, original_name, mime_type, size_bytes, document_type,
                   owner_module, owner_entity_type, uploaded_by_user_id, ${extraColumns})
                  VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', $2, $3, $4, ${extraValues})`,
                [randomUUID(), owner.owner_module, owner.owner_entity_type, admin.id]),
                (error) => error.code === '23514' && error.constraint === `chk_${table}_${column}`);
              }
            }
          }
          const { assertStorageOwner } = load('storage/storage-owner.validation.js');
          for (const value of ['_internal', '1c_receipt', '-private', 'a'.repeat(64)]) {
            assert.doesNotThrow(() => assertStorageOwner({ module: value, entityType: value, entityId: '125' }));
            for (const table of ['storage_files', 'storage_uploads']) {
              const extraColumns = table === 'storage_files' ? 'owner_entity_id' : 'id, sha256';
              const extraValues = table === 'storage_files' ? "'125'" : "gen_random_uuid(), repeat('a', 64)";
              const result = await client.query(`INSERT INTO ${table}
                (bucket, object_key, original_name, mime_type, size_bytes, document_type,
                 owner_module, owner_entity_type, uploaded_by_user_id, ${extraColumns})
                VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', $2, $2, $3, ${extraValues}) RETURNING id`,
              [randomUUID(), value, admin.id]);
              await client.query(`DELETE FROM ${table} WHERE id = $1`, [result.rows[0].id]);
            }
          }
          for (const value of ['', 'x'.repeat(129)]) {
            await assert.rejects(client.query(`INSERT INTO storage_files
              (bucket, object_key, original_name, mime_type, size_bytes, document_type, owner_module, owner_entity_type, owner_entity_id)
              VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', 'warehouse', 'stock_adjustment', $2)`, [randomUUID(), value]),
            (error) => value ? error.code === '22001' : error.code === '23514' && error.constraint === 'chk_storage_files_owner_entity_id');
          }
        } finally {
          await client.end();
        }
      });
      const item = await prisma.warehouseItem.create({ data: { id: 9007199254740993n, article: 'ADJUST-A', name: 'Bearing', unit: 'шт' } });
      const location = await prisma.warehouseStorageLocation.create({
        data: {
          warehouse: {
            connectOrCreate: {
              where: { code: "TEST" },
              create: { code: "TEST", name: "Test warehouse" },
            },
          },
          id: 9007199254740993n,
          code: "A",
          name: "Shelf",
        },
      });
      const audit = new AuditLogService(prisma);
      const stock = new WarehouseStockService(new WarehouseStockQueryService(prisma), audit);
      const policy = new StorageFilePolicyService({ primaryDocumentTypes: [], singleDocumentTypes: [], documentRules: {
        supporting_document: { allowedExtensions: ['pdf', 'png'], allowedMimeTypes: ['application/pdf', 'image/png'], validateContent: 'document' },
      } });
      const staged = new StorageStagedUploadService(prisma, objects, policy);
      const access = new WarehouseStockAdjustmentAccessService();
      const queries = new WarehouseStockAdjustmentQueryService(prisma, access);
      const documents = new WarehouseStockAdjustmentDocumentService(prisma, staged, access);
      const adjustments = new WarehouseStockAdjustmentsService(
        new WarehouseStockAdjustmentCommandService(prisma, stock, staged, audit, access),
        queries,
        documents,
      );
      const file = { buffer: Buffer.from('%PDF-1.4\nDocument\n%%EOF'), originalname: 'basis.pdf', mimetype: 'application/pdf', size: 30 };
      const upload = async (actor = admin.id) => (await adjustments.uploadDocument(file, actor)).uploadId;
      const request = async (extra = {}, actor = admin.id) => ({
        itemId: item.id.toString(), locationId: location.id.toString(), requestKey: randomUUID(),
        type: 'WRITE_OFF', quantity: '4', reason: 'Inventory shortage', attachments: [await upload(actor)], ...extra,
      });
      const quantity = async () => (await stock.getBalance(item.id.toString(), location.id.toString()))?.quantity;
      const initial = await prisma.$transaction((tx) => stock.receiveStock({ tx, actorUserId: admin.id }, item.id.toString(), location.id.toString(), '20'));
      const projectRow = await prisma.warehouseProject.create({ data: { projectNumber: 'ADJUST-PROJECT' } });
      const reservation = await prisma.warehouseProjectReservation.create({ data: { balanceId: BigInt(initial.id), projectId: projectRow.id, quantity: '18' } });

      await t.test('admin can record a physical shortage without silently reducing project reservations', async () => {
        const result = await adjustments.adjustStock(await request(), admin.id);
        assert.equal(result.adjustment.quantityBefore, '20');
        assert.equal(result.adjustment.quantityAfter, '16');
        assert.equal(result.adjustment.itemId, item.id.toString());
        assert.equal(result.adjustment.attachments.length, 1);
        assert.equal((await prisma.warehouseProjectReservation.findUniqueOrThrow({ where: { id: reservation.id } })).quantity.toString(), '18');
        const log = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'warehouse_stock_adjustment', entityStringId: result.adjustment.id } });
        const snapshot = JSON.parse(log.newValue);
        assert.equal(snapshot.shortageAfter, '2');
        assert.equal(snapshot.reserved, '18');
        assert.equal(snapshot.reason, 'Inventory shortage');
        assert.equal(snapshot.attachments.length, 1);
        assert.match(snapshot.attachments[0].sha256, /^[a-f0-9]{64}$/);
        assert.equal(log.userId, admin.id);
        assert.equal((await adjustments.get(result.adjustment.id, admin.id)).quantityAfter, '16');
        const page = await adjustments.list({ itemId: item.id.toString(), type: 'WRITE_OFF', limit: '1' }, admin.id);
        assert.equal(page.total, 1);
        assert.equal(page.items[0].id, result.adjustment.id);
      });

      await t.test('only admin may upload, create or read; revoked and banned admins are rejected', async () => {
        await assert.rejects(adjustments.uploadDocument(file, keeper.id), code('FORBIDDEN'));
        const payload = await request();
        await assert.rejects(adjustments.adjustStock(payload, keeper.id), code('FORBIDDEN'));
        await assert.rejects(adjustments.get('1', keeper.id), code('FORBIDDEN'));
        await assert.rejects(adjustments.list({}, keeper.id), code('FORBIDDEN'));
        await prisma.user.update({ where: { id: secondAdmin.id }, data: { banned: true } });
        await assert.rejects(adjustments.uploadDocument(file, secondAdmin.id), code('FORBIDDEN'));
        await prisma.user.update({ where: { id: secondAdmin.id }, data: { banned: false, role: 'storekeeper' } });
        await assert.rejects(adjustments.adjustStock(payload, secondAdmin.id), code('FORBIDDEN'));
        await prisma.user.update({ where: { id: secondAdmin.id }, data: { role: 'admin' } });
      });

      await t.test('repeat and concurrent identical requests create one adjustment; changed payload conflicts', async () => {
        const payload = await request({ type: 'SURPLUS', quantity: '3' });
        const before = await prisma.auditLog.count();
        const [first, second] = await Promise.all([adjustments.adjustStock(payload, admin.id), adjustments.adjustStock(payload, admin.id)]);
        assert.deepEqual(first, second);
        assert.equal(await quantity(), '19');
        assert.equal(await prisma.auditLog.count(), before + 2);
        await assert.rejects(adjustments.adjustStock({ ...payload, quantity: '4' }, admin.id), code('WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT'));
      });

      await t.test('actual counting uses a locked expected quantity and no-op creates no operation', async () => {
        const payload = await request();
        delete payload.type; delete payload.quantity;
        payload.actualQuantity = '21'; payload.expectedQuantity = '19';
        const result = await adjustments.adjustStock(payload, admin.id);
        assert.equal(result.adjustment.type, 'SURPLUS');
        assert.equal(result.adjustment.quantity, '2');
        const stale = { ...payload, requestKey: randomUUID(), attachments: [await upload()], actualQuantity: '16' };
        await assert.rejects(adjustments.adjustStock(stale, admin.id), code('WAREHOUSE_ADJUSTMENT_STALE_BALANCE'));
        const count = await prisma.warehouseStockAdjustment.count();
        const logs = await prisma.auditLog.count();
        const noOp = { ...stale, expectedQuantity: '21', actualQuantity: '21' };
        assert.deepEqual(await adjustments.adjustStock(noOp, admin.id), { changed: false, quantity: '21', adjustment: null });
        assert.equal(await prisma.warehouseStockAdjustment.count(), count);
        assert.equal(await prisma.auditLog.count(), logs);
        const down = { ...noOp, requestKey: randomUUID(), actualQuantity: '17' };
        assert.equal((await adjustments.adjustStock(down, admin.id)).adjustment.type, 'WRITE_OFF');
        assert.equal(await quantity(), '17');
      });

      await t.test('documents are required, scoped to their author and operation, and cannot be reused', async () => {
        const stagedBefore = await prisma.storageUpload.count();
        await assert.rejects(adjustments.uploadDocument({ ...file, buffer: Buffer.from('not a pdf') }, admin.id), code('INVALID_PDF'));
        assert.equal(await prisma.storageUpload.count(), stagedBefore);
        const payload = await request();
        await assert.rejects(adjustments.adjustStock({ ...payload, attachments: [] }, admin.id), code('WAREHOUSE_ADJUSTMENT_INVALID'));
        await assert.rejects(adjustments.adjustStock(payload, secondAdmin.id), code('STORAGE_UPLOAD_UNAVAILABLE'));
        const foreign = await staged.prepare({ module: 'another', entityType: 'document' }, admin.id, 'supporting_document', file);
        await assert.rejects(adjustments.adjustStock({ ...payload, attachments: [foreign.uploadId] }, admin.id), code('STORAGE_UPLOAD_UNAVAILABLE'));
        const used = await adjustments.adjustStock({ ...payload, type: 'SURPLUS', quantity: '1' }, admin.id);
        await assert.rejects(adjustments.adjustStock({ ...payload, requestKey: randomUUID() }, admin.id), code('STORAGE_UPLOAD_UNAVAILABLE'));
        assert.equal(used.adjustment.attachments.length, 1);
        const expired = await upload();
        await prisma.storageUpload.update({ where: { id: expired }, data: { expiresAt: new Date(0) } });
        await assert.rejects(adjustments.adjustStock({ ...payload, requestKey: randomUUID(), attachments: [expired] }, admin.id), code('STORAGE_UPLOAD_UNAVAILABLE'));
      });

      await t.test('insufficient stock and audit failures roll back quantities, operation, file binding and logs', async () => {
        const payload = await request({ quantity: '99' });
        const before = await quantity();
        const operationCount = await prisma.warehouseStockAdjustment.count();
        const logCount = await prisma.auditLog.count();
        await assert.rejects(adjustments.adjustStock(payload, admin.id), code('WAREHOUSE_STOCK_INSUFFICIENT'));
        const failing = new WarehouseStockAdjustmentsService(
          new WarehouseStockAdjustmentCommandService(prisma, stock, staged, { async writeFieldChanges() { throw new Error('Injected adjustment audit failure'); } }, access),
          queries,
          documents,
        );
        await assert.rejects(failing.adjustStock({ ...payload, quantity: '1' }, admin.id), /adjustment audit failure/);
        assert.equal(await quantity(), before);
        assert.equal(await prisma.warehouseStockAdjustment.count(), operationCount);
        assert.equal(await prisma.auditLog.count(), logCount);
        assert.ok(await prisma.storageUpload.findUnique({ where: { id: payload.attachments[0] } }));
      });

      await t.test('posted documents are immutable and downloads remain owner-bound', async () => {
        const operation = await prisma.warehouseStockAdjustment.findFirstOrThrow({ include: { attachments: true } });
        const fileId = operation.attachments[0].fileId;
        const owner = { ...ADJUSTMENT_OWNER, entityId: operation.id.toString() };
        const files = new StorageFileService(audit, objects, new StorageOwnerLockService(), new StorageOwnerService(prisma), {}, {}, prisma, {});
        assert.equal((await files.getDownload({ fileId, owner })).contentType, 'application/pdf');
        await assert.rejects(files.getDownload({ fileId, owner: { ...owner, entityId: 'another-id' } }), /Файл не найден/);
        await assert.rejects(files.softDeleteFile({ fileId, owner, userId: admin.id, audit: { actionModule: 'WAREHOUSE' } }), code('STORAGE_FILE_IMMUTABLE'));
        const primary = new StorageFilePrimaryService(audit, new StorageOwnerLockService(), policy, prisma);
        await assert.rejects(primary.setPrimaryFile({ fileId, owner, userId: admin.id, audit: { actionModule: 'WAREHOUSE' } }), code('STORAGE_FILE_IMMUTABLE'));
        assert.equal((await prisma.storageFile.findUniqueOrThrow({ where: { id: fileId } })).deletedAt, null);
      });

      await t.test('staging survives failures and cleanup retries without deleting attached objects', async () => {
        failPut = true;
        await assert.rejects(upload(), code('STORAGE_UPLOAD_FAILED'));
        failPut = false;
        const pending = await prisma.storageUpload.findFirstOrThrow({ where: { uploadedAt: null } });
        assert.ok(bytes.has(pending.objectKey));
        failDelete = true;
        await staged.cleanupExpired();
        assert.ok(await prisma.storageUpload.findUnique({ where: { id: pending.id } }));
        failDelete = false;
        const filesBefore = await prisma.storageFile.findMany();
        const previousDeletes = deletes;
        await Promise.all([staged.cleanupExpired(), staged.cleanupExpired()]);
        assert.equal(await prisma.storageUpload.findUnique({ where: { id: pending.id } }), null);
        assert.ok(deletes > previousDeletes);
        for (const saved of filesBefore) assert.ok(bytes.has(saved.objectKey));
      });

      await t.test('generic storage accepts UUID/bigint owners without a module enum', async () => {
        for (const entityId of [randomUUID(), '9223372036854775807']) {
          const scope = { module: 'new_module', entityType: 'new_document' };
          const pending = await staged.prepare(scope, admin.id, 'supporting_document', file);
          const [bound] = await prisma.$transaction((tx) => staged.attach(tx, [pending.uploadId], { ...scope, entityId }, admin.id, true));
          assert.equal(bound.ownerEntityId, entityId);
          assert.equal(bound.ownerModule, 'new_module');
          assert.equal(bound.isImmutable, true);
        }
      });
    } finally { await prisma.$disconnect(); }
  } finally { await env.close(); }
});
