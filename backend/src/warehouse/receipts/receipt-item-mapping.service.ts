import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseCatalogExternalLinksService } from '../catalog/catalog-external-links.service';
import { WarehouseCatalogService } from '../catalog/catalog.service';
import { stockId } from '../stock/stock.validation';
import { receiptActor, receiptAudit, receiptConflict } from './receipts.policy';
import { invalid, record } from './receipts.validation';
@Injectable()
export class WarehouseReceiptItemMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly catalog: WarehouseCatalogService,
    private readonly links: WarehouseCatalogExternalLinksService,
  ) {}
  mapItem(
    receiptValue: string,
    lineValue: string,
    value: unknown,
    actor: string,
  ) {
    const b = record(value, ['itemId', 'create']);
    if ((b.itemId === undefined) === (b.create === undefined))
      invalid('Укажите itemId либо create.');
    const itemId = b.itemId === undefined ? null : stockId(b.itemId, 'itemId');
    const creating = b.create !== undefined;
    return this.prisma.$transaction(
      async (tx) => {
        await receiptActor(tx, actor, 'warehouse.receipts.map');
        const line = await tx.warehouseReceiptLine.findFirst({
          where: {
            id: stockId(lineValue, 'lineId'),
            receiptId: stockId(receiptValue, 'receiptId'),
          },
          include: { receipt: true },
        });
        if (!line || !line.externalItemId || line.receipt.source !== 'ONE_C')
          throw new NotFoundException({
            code: 'WAREHOUSE_RECEIPT_LINE_NOT_FOUND',
            message: 'Исходная строка 1С не найдена.',
          });
        const sourceSystem = line.receipt.sourceSystem,
          externalId = line.externalItemId;
        await this.links.lockIdentities(tx, [{ sourceSystem, externalId }]);
        await tx.$queryRaw`SELECT r.id FROM warehouse_receipts r WHERE EXISTS(SELECT 1 FROM warehouse_receipt_lines l WHERE l.receipt_id=r.id AND l.external_item_id=${externalId}) AND r.source_system=${sourceSystem} ORDER BY r.id FOR UPDATE`;
        const latest = await tx.warehouseReceiptLine.findUnique({
          where: { id: line.id },
        });
        if (!latest || latest.externalItemId !== externalId)
          receiptConflict(
            'WAREHOUSE_RECEIPT_STALE_MAPPING',
            'Строка была изменена. Обновите документ.',
          );
        const identity = { sourceSystem, externalId };
        const previous = await this.links.find(tx, identity);
        if (previous) {
          if (creating || previous.itemId !== String(itemId))
            receiptConflict(
              'WAREHOUSE_RECEIPT_MAPPING_CONFLICT',
              'Внешняя позиция уже сопоставлена.',
            );
          return { itemId: String(previous.itemId) };
        }
        const resolvedId = creating
          ? BigInt((await this.catalog.create(b.create, actor, tx)).id)
          : itemId!;
        const [item] = await this.catalog.lockItemsForOperation(
          [String(resolvedId)],
          tx,
        );
        if (!item)
          throw new NotFoundException({
            code: 'WAREHOUSE_ITEM_NOT_FOUND',
            message: 'Номенклатура не найдена.',
          });
        if (!item.isActive)
          receiptConflict(
            'WAREHOUSE_RECEIPT_INACTIVE_REFERENCE',
            'Номенклатура неактивна.',
          );
        const mismatch = await tx.warehouseReceiptLine.count({
          where: {
            externalItemId: externalId,
            receipt: { sourceSystem, source: 'ONE_C' },
            unitSnapshot: { not: item.unit },
          },
        });
        if (mismatch)
          receiptConflict(
            'WAREHOUSE_RECEIPT_UNIT_MISMATCH',
            'Единицы источника и ESoft должны совпадать.',
          );
        await this.links.bind(
          tx,
          {
            ...identity,
            itemId: item.id,
            sourceArticle: latest.itemArticleSnapshot,
            sourceName: latest.itemNameSnapshot,
          },
          actor,
        );
        await tx.warehouseReceiptLine.updateMany({
          where: {
            externalItemId: externalId,
            receipt: { sourceSystem, source: 'ONE_C' },
          },
          data: { itemId: BigInt(item.id) },
        });
        await receiptAudit(
          this.audit,
          tx,
          actor,
          line.receiptId,
          'Сопоставление номенклатуры',
          { ...identity, itemId: String(item.id), created: creating },
        );
        return { itemId: String(item.id) };
      },
      { timeout: 15000 },
    );
  }
}
