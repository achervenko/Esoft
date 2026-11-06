import { WarehouseCatalogService } from '../catalog/catalog.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseStockService } from '../stock/stock.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { parsePlacement, receiptHash } from './receipts.validation';
import { placementDto } from './receipts.mapper';
import {
  lockReceipt,
  placedQuantity,
  receiptActor,
  receiptAudit,
  receiptConflict,
  receiptProgress,
} from './receipts.policy';
@Injectable()
export class WarehouseReceiptPlacementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly audit: AuditLogService,
    private readonly catalog: WarehouseCatalogService,
  ) {}
  place(
    receiptValue: string,
    lineValue: string,
    value: unknown,
    actor: string,
  ) {
    const input = parsePlacement(value),
      lineId = stockId(lineValue, 'lineId'),
      receiptId = stockId(receiptValue, 'receiptId');
    const hash = receiptHash({
      receiptId: String(receiptId),
      lineId: String(lineId),
      storageLocationId: input.storageLocationId,
      quantity: input.quantity,
    });
    return this.prisma.$transaction(
      async (tx) => {
        await receiptActor(tx, actor, 'warehouse.receipts.place');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:placement', actor, input.requestKey])},0))`;
        const previous = await tx.warehouseReceiptPlacement.findUnique({
          where: {
            createdByUserId_requestKey: {
              createdByUserId: actor,
              requestKey: input.requestKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            receiptConflict(
              'WAREHOUSE_RECEIPT_REQUEST_CONFLICT',
              'Ключ размещения уже использован.',
            );
          return placementDto(previous);
        }
        await lockReceipt(tx, receiptValue);
        const receipt = await tx.warehouseReceipt.findUniqueOrThrow({
          where: { id: receiptId },
        });
        if (receipt.status === 'CANCELLED' || receipt.conflict)
          receiptConflict(
            'WAREHOUSE_RECEIPT_BLOCKED',
            'Документ отменён или имеет конфликт.',
          );
        const line = await tx.warehouseReceiptLine.findFirst({
          where: { id: lineId, receiptId },
        });
        if (!line)
          throw new NotFoundException({
            code: 'WAREHOUSE_RECEIPT_LINE_NOT_FOUND',
            message: 'Строка прихода не найдена.',
          });
        if (!receipt.warehouseId || !line.itemId)
          receiptConflict(
            'WAREHOUSE_RECEIPT_UNMAPPED',
            'Сопоставьте склад и номенклатуру.',
          );
        if (line.sourceType !== 'GOODS')
          receiptConflict(
            'WAREHOUSE_RECEIPT_ITEM_TYPE',
            'Размещать можно только товар.',
          );
        if (line.reconciledToLineId)
          receiptConflict(
            'WAREHOUSE_RECEIPT_RECONCILED',
            'Ручной приход уже связан с документом 1С.',
          );
        const placed = await placedQuantity(tx, lineId);
        if (placed.plus(input.quantity).gt(line.quantity))
          receiptConflict(
            'WAREHOUSE_RECEIPT_OVERPLACEMENT',
            'Количество превышает остаток к размещению.',
          );
        await lockWarehouse(tx, receipt.warehouseId, true);
        await this.stock.lockBalances(tx, String(line.itemId), [
          input.storageLocationId,
        ]);
        const [item] = await this.catalog.lockItemsForOperation(
          [String(line.itemId)],
          tx,
        );
        const location = await tx.warehouseStorageLocation.findUniqueOrThrow({
          where: { id: BigInt(input.storageLocationId) },
          include: { warehouse: true },
        });
        if (!item.isActive || !location.isActive)
          receiptConflict(
            'WAREHOUSE_RECEIPT_INACTIVE_REFERENCE',
            'Товар или место неактивны.',
          );
        if (location.warehouseId !== receipt.warehouseId)
          receiptConflict(
            'WAREHOUSE_RECEIPT_LOCATION_MISMATCH',
            'Место относится к другому складу.',
          );
        if (item.unit !== line.unitSnapshot)
          receiptConflict(
            'WAREHOUSE_RECEIPT_UNIT_MISMATCH',
            'Единица товара отличается от документа.',
          );
        const row = await tx.warehouseReceiptPlacement.create({
          data: {
            receiptLineId: lineId,
            storageLocationId: location.id,
            quantity: input.quantity,
            createdByUserId: actor,
            requestKey: input.requestKey,
            requestHash: hash,
            itemSnapshot: {
              id: String(item.id),
              article: item.article,
              name: item.name,
              unit: item.unit,
            },
            locationSnapshot: {
              id: String(location.id),
              name: location.name,
              warehouseId: String(receipt.warehouseId),
              warehouseName: location.warehouse.name,
            },
          },
        });
        await this.stock.receiveStock(
          { tx, actorUserId: actor },
          String(item.id),
          String(location.id),
          input.quantity,
        );
        await receiptProgress(tx, receiptId);
        const dto = placementDto(row);
        await receiptAudit(
          this.audit,
          tx,
          actor,
          receiptId,
          'Размещение товара',
          dto,
        );
        return dto;
      },
      { timeout: 15000 },
    );
  }
}
