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
import { WarehouseNotificationsService } from '../warehouse-notifications.service';
import { receiptHash } from './receipts.validation';
import {
  parseSourceReceipt,
  type ReceiptImportGroup,
} from './receipts-import.contract';
import {
  existingGroups,
  findLegacyReceipt,
  placedGroups,
  suspend,
  refreshInvoiceReceiptOrders,
} from './receipt-invoice-import-data';
import {
  receiptActor,
  receiptAudit,
  receiptConflict,
  receiptProgress,
  type Tx,
} from './receipts.policy';
import { receiptView, receiptInclude } from './receipts.mapper';
import {
  externalOneCUuid,
  findReceiptWarehouseLinks,
  lockReceiptWarehouseLink,
} from './receipt-warehouse-links';
export class ReceiptImportWarehouseError extends Error {
  constructor(
    readonly code: 'WAREHOUSE_UNMAPPED' | 'WAREHOUSE_INACTIVE',
    readonly previouslyImported = false,
  ) {
    super(code);
  }
}

type InvoiceOrders = {
  matches: ReadonlyMap<string, string>;
};

@Injectable()
export class WarehouseReceiptImportService {
  constructor(
    private readonly audit: AuditLogService,
    private readonly links: WarehouseCatalogExternalLinksService,
    private readonly catalog: WarehouseCatalogService,
    private readonly notifications: WarehouseNotificationsService,
  ) {}
  findLegacyInvoiceReceipt(tx: Tx, invoiceId: string) {
    return findLegacyReceipt(tx, invoiceId);
  }

  lockInvoiceGroups(tx: Tx, invoiceId: string) {
    return existingGroups(tx, invoiceId);
  }

  findPlacedInvoiceGroups(tx: Tx, receipts: ReceiptImportGroup[]) {
    return placedGroups(tx, receipts);
  }

  async lockAndReadWarehouseLinks(
    tx: Tx,
    sourceCode: string,
    externalId: string,
  ) {
    await lockReceiptWarehouseLink(tx, sourceCode, externalId);
    return findReceiptWarehouseLinks(tx, sourceCode, externalId);
  }

  async suspendInvoiceGroup(
    tx: Tx,
    actorUserId: string,
    receipt: ReceiptImportGroup,
    conflict: string | null,
    invoice: { id: string; status: string },
  ) {
    await suspend(this.audit, tx, actorUserId, receipt, conflict, invoice);
    await this.notifications.receipt(tx, receipt.id);
  }

  refreshInvoiceReceiptOrders(tx: Tx, receiptId: bigint) {
    return refreshInvoiceReceiptOrders(tx, receiptId);
  }

  lockItemIdentities(tx: Tx, sourceSystem: string, itemIds: readonly string[]) {
    return this.links.lockIdentities(
      tx,
      itemIds.map((externalId) => ({ sourceSystem, externalId })),
    );
  }
  async applySnapshot(
    tx: Tx,
    sourceSystem: string,
    value: unknown,
    actor: string,
    orders?: InvoiceOrders,
  ) {
    const input = parseSourceReceipt(value, '1');
    await receiptActor(
      tx,
      actor,
      'warehouse.receipts.integration',
      sourceSystem,
    );
    await this.lockItemIdentities(
      tx,
      sourceSystem,
      input.lines.map((line) => line.item.id),
    );
    await lockReceiptWarehouseLink(tx, sourceSystem, input.warehouse.id);
    const identity = {
      source: 'ONE_C',
      sourceSystem,
      sourceOperationId: input.id,
    };
    const global = !!orders || externalOneCUuid.test(input.id);
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', global ? input.id.toLowerCase() : identity])}, 0))
    `;
    const previous = await tx.warehouseReceipt.findFirst({
      where: global
        ? {
            source: identity.source,
            sourceOperationId: { equals: input.id, mode: 'insensitive' },
          }
        : identity,
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
      orders,
    );
  }
  async apply(
    tx: Tx,
    sourceSystem: string,
    value: unknown,
    actor: string,
    orders?: InvoiceOrders,
  ) {
    const input = parseSourceReceipt(value);
    await receiptActor(
      tx,
      actor,
      'warehouse.receipts.integration',
      sourceSystem,
    );
    await this.lockItemIdentities(
      tx,
      sourceSystem,
      input.lines.map((line) => line.item.id),
    );
    await lockReceiptWarehouseLink(tx, sourceSystem, input.warehouse.id);
    const identity = {
      source: 'ONE_C',
      sourceSystem,
      sourceOperationId: input.id,
    };
    const global = !!orders || externalOneCUuid.test(input.id);
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', global ? input.id.toLowerCase() : identity])}, 0))
    `;
    const warehouseLinks = await findReceiptWarehouseLinks(
      tx,
      sourceSystem,
      input.warehouse.id,
    );
    const [warehouseLink] = warehouseLinks;
    if (
      warehouseLink &&
      warehouseLinks.some(
        (link) => link.warehouseId !== warehouseLink.warehouseId,
      )
    )
      receiptConflict(
        'WAREHOUSE_RECEIPT_MAPPING_CONFLICT',
        'UUID склада 1С связан с разными складами ESoft.',
      );
    const previous = await tx.warehouseReceipt.findFirst({
      where: global
        ? {
            source: identity.source,
            sourceOperationId: { equals: input.id, mode: 'insensitive' },
          }
        : identity,
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
      await this.notifications.receipt(tx, row.id);
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
    await saveReceiptImportLines(tx, row.id, input, oldLines, bindings, orders);
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
    await this.notifications.receipt(
      tx,
      row.id,
      !previous && input.lines.some(({ item }) => item.type === 'GOODS'),
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
