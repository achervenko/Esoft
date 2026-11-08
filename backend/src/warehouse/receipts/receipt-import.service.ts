import { receiptImportConflict } from './receipt-import-conflicts';
import {
  saveReceiptImportLines,
  saveReceiptImportDocument,
  prepareReceiptImportLines,
} from './receipt-import-lines';
import { WarehouseCatalogExternalLinksService } from '../catalog/catalog-external-links.service';
import { WarehouseCatalogService } from '../catalog/catalog.service';
import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { receiptHash } from './receipts.validation';
import { parseSourceReceipt } from './receipts-import.contract';
import {
  receiptActor,
  receiptAudit,
  receiptConflict,
  receiptProgress,
  type Tx,
} from './receipts.policy';
import { receiptView, receiptInclude } from './receipts.mapper';
export class ReceiptImportWarehouseError extends Error {
  constructor(
    readonly code: 'WAREHOUSE_UNMAPPED' | 'WAREHOUSE_INACTIVE',
    readonly previouslyImported = false,
  ) {
    super(code);
  }
}

@Injectable()
export class WarehouseReceiptImportService {
  constructor(
    private readonly audit: AuditLogService,
    private readonly links: WarehouseCatalogExternalLinksService,
    private readonly catalog: WarehouseCatalogService,
  ) {}
  async applySnapshot(
    tx: Tx,
    sourceSystem: string,
    value: unknown,
    actor: string,
  ) {
    const input = parseSourceReceipt(value, '1');
    await receiptActor(
      tx,
      actor,
      'warehouse.receipts.integration',
      sourceSystem,
    );
    const identity = {
      source: 'ONE_C',
      sourceSystem,
      sourceOperationId: input.id,
    };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', identity])},0))`;
    const previous = await tx.warehouseReceipt.findUnique({
      where: { source_sourceSystem_sourceOperationId: identity },
    });
    let revision = previous?.sourceVersion ?? 0n;
    if (
      revision === 0n ||
      receiptHash(parseSourceReceipt(value, revision.toString())) !==
        previous?.requestHash
    )
      revision += 1n;
    if (revision > 9223372036854775807n)
      receiptConflict(
        'WAREHOUSE_RECEIPT_REVISION_EXHAUSTED',
        'Исчерпан диапазон внутренних редакций.',
      );
    return this.apply(
      tx,
      sourceSystem,
      { ...(value as Record<string, unknown>), version: revision.toString() },
      actor,
    );
  }
  async apply(tx: Tx, sourceSystem: string, value: unknown, actor: string) {
    const input = parseSourceReceipt(value);
    await receiptActor(
      tx,
      actor,
      'warehouse.receipts.integration',
      sourceSystem,
    );
    const identity = {
      source: 'ONE_C',
      sourceSystem,
      sourceOperationId: input.id,
    };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', identity])},0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:warehouse-link', sourceSystem, input.warehouse.id])},0))`;
    const [warehouseLink] = await tx.$queryRaw<
      { warehouseId: bigint; isActive: boolean }[]
    >`
      SELECT link.warehouse_id AS "warehouseId", w.is_active AS "isActive"
      FROM warehouse_external_warehouses link JOIN warehouses w ON w.id=link.warehouse_id
      WHERE link.source_system=${sourceSystem} AND link.external_id=${input.warehouse.id}
      FOR SHARE OF link, w`;
    const previous = await tx.warehouseReceipt.findUnique({
      where: { source_sourceSystem_sourceOperationId: identity },
    });
    if (!warehouseLink)
      throw new ReceiptImportWarehouseError('WAREHOUSE_UNMAPPED', !!previous);
    if (!warehouseLink.isActive)
      throw new ReceiptImportWarehouseError('WAREHOUSE_INACTIVE', !!previous);
    if (
      previous &&
      previous.sourceVersion !== null &&
      previous.sourceVersion >= BigInt(input.version)
    ) {
      if (
        previous.sourceVersion === BigInt(input.version) &&
        previous.requestHash !== receiptHash(input)
      )
        receiptConflict(
          'WAREHOUSE_RECEIPT_VERSION_CONFLICT',
          'Одна версия документа содержит разные данные.',
        );
      return receiptView(
        await tx.warehouseReceipt.findUniqueOrThrow({
          where: { id: previous.id },
          include: receiptInclude,
        }),
        this.catalog,
        tx,
      );
    }
    const { bindings, oldLines } = await prepareReceiptImportLines(
      tx,
      sourceSystem,
      input,
      previous?.id ?? null,
      this.links,
      this.catalog,
    );
    const conflict = await receiptImportConflict(tx, input, previous, oldLines);
    const sourceData = {
      sourceVersion: BigInt(input.version),
      requestHash: receiptHash(input),
      receivedAt: new Date(),
    };
    if (previous && conflict) {
      const row = await tx.warehouseReceipt.update({
        where: { id: previous.id },
        data: { ...sourceData, pendingPayload: input, conflict },
        include: receiptInclude,
      });
      await receiptAudit(
        this.audit,
        tx,
        actor,
        row.id,
        'Конфликт версии прихода',
        { code: conflict, source: input },
      );
      return receiptView(row, this.catalog, tx);
    }
    const row = await saveReceiptImportDocument(
      tx,
      input,
      previous,
      sourceSystem,
      warehouseLink.warehouseId,
      actor,
      sourceData,
    );
    await saveReceiptImportLines(tx, row.id, input, oldLines, bindings);
    if (input.status !== 'CANCELLED') await receiptProgress(tx, row.id);
    await receiptAudit(
      this.audit,
      tx,
      actor,
      row.id,
      previous ? 'Обновление документа 1С' : 'Получение документа 1С',
      input,
      previous ? AuditAction.UPDATE : AuditAction.CREATE,
    );
    return receiptView(
      await tx.warehouseReceipt.findUniqueOrThrow({
        where: { id: row.id },
        include: receiptInclude,
      }),
      this.catalog,
      tx,
    );
  }
}
