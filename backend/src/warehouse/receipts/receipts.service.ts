import { WarehouseCatalogService } from '../catalog/catalog.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import {
  reservationOrderDto,
  reservationOrderSelect,
} from '../reservations/reservations.dto';
import { parseManualReceipt, receiptHash } from './receipts.validation';
import { receiptView, receiptInclude } from './receipts.mapper';
import {
  receiptActor,
  receiptAudit,
  receiptConflict,
  lockReceipt,
  placedQuantity,
} from './receipts.policy';
@Injectable()
export class WarehouseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly catalog: WarehouseCatalogService,
  ) {}
  createManual(value: unknown, actor: string) {
    const { input, requestKey } = parseManualReceipt(value),
      hash = receiptHash({
        ...input,
        lines: input.lines
          .map(({ itemId, draftId, quantity, orderId }) => ({
            itemId,
            ...(draftId ? { draftId } : {}),
            quantity,
            ...(orderId ? { orderId } : {}),
          }))
          .sort((a, b) => {
            if (a.itemId !== undefined && b.itemId === undefined) return -1;
            if (a.itemId === undefined && b.itemId !== undefined) return 1;
            const left = a.itemId !== undefined ? BigInt(a.itemId) : a.draftId!;
            const right =
              b.itemId !== undefined ? BigInt(b.itemId) : b.draftId!;
            if (left < right) return -1;
            if (left > right) return 1;
            const byOrder = (a.orderId ?? '').localeCompare(b.orderId ?? '');
            if (byOrder) return byOrder;
            return new Prisma.Decimal(a.quantity).comparedTo(b.quantity);
          }),
      });
    const identity = {
      source: 'MANUAL',
      sourceSystem: 'ESOFT',
      sourceOperationId: JSON.stringify([actor, requestKey]),
    };
    return this.prisma.$transaction(
      async (tx) => {
        await receiptActor(tx, actor, 'warehouse.receipts.manage');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', identity])},0))`;
        const previous = await tx.warehouseReceipt.findUnique({
          where: { source_sourceSystem_sourceOperationId: identity },
          include: receiptInclude,
        });
        if (previous) {
          if (previous.requestHash !== hash)
            receiptConflict(
              'WAREHOUSE_RECEIPT_REQUEST_CONFLICT',
              'Ключ уже использован с другими данными.',
            );
          return receiptView(previous, this.catalog, tx);
        }
        const warehouseId = BigInt(input.warehouseId);
        await lockWarehouse(tx, warehouseId, true);
        const warehouse = await tx.warehouse.findUniqueOrThrow({
          where: { id: warehouseId },
        });
        const orders = await tx.customerOrder.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  input.lines.flatMap((line) =>
                    line.orderId ? [line.orderId] : [],
                  ),
                ),
              ],
            },
          },
          select: reservationOrderSelect,
        });
        for (const line of input.lines)
          if (
            line.orderId &&
            !orders.some((order) => order.id === line.orderId)
          )
            throw new NotFoundException({
              code: 'WAREHOUSE_RESERVATION_ORDER_NOT_FOUND',
              message: 'Заказ не найден.',
            });
        const draftItems = new Map<string, string>();
        for (const draft of input.newItems ?? []) {
          if (!input.lines.some((line) => line.draftId === draft.draftId))
            continue;
          const created = await this.catalog.create(draft.item, actor, tx);
          draftItems.set(draft.draftId, created.id);
        }
        const resolvedLines = input.lines.map((line) => ({
          ...line,
          itemId: line.itemId ?? draftItems.get(line.draftId!)!,
        }));
        const ids = [...new Set(resolvedLines.map((l) => l.itemId))].sort(
          (a, b) => (BigInt(a) < BigInt(b) ? -1 : 1),
        );
        const items = await this.catalog.lockItemsForOperation(ids, tx);
        const lines = resolvedLines.map((l) => {
          const item = items.find((i) => i.id === l.itemId);
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
          return {
            rowNumber: l.rowNumber,
            externalLineId: String(l.rowNumber),
            itemId: BigInt(item.id),
            quantity: l.quantity,
            unitSnapshot: item.unit,
            itemArticleSnapshot: item.article,
            itemNameSnapshot: item.name,
            ...(l.orderId
              ? {
                  orderId: l.orderId,
                  orderSnapshot: reservationOrderDto(
                    orders.find((order) => order.id === l.orderId)!,
                  ),
                }
              : {}),
          };
        });
        const row = await tx.warehouseReceipt.create({
          data: {
            ...identity,
            requestHash: hash,
            warehouseId,
            warehouseNameSnapshot: warehouse.name,
            documentNumber: input.documentNumber,
            documentDate: input.documentDate
              ? new Date(input.documentDate + 'T00:00:00Z')
              : null,
            comment: input.comment,
            createdByUserId: actor,
            lines: { create: lines },
          },
          include: receiptInclude,
        });
        const dto = await receiptView(row, this.catalog, tx);
        await receiptAudit(
          this.audit,
          tx,
          actor,
          row.id,
          'Создан ручной приход',
          dto,
          AuditAction.CREATE,
        );
        return dto;
      },
      { timeout: 15000 },
    );
  }
  cancelManual(value: string, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      await receiptActor(tx, actor, 'warehouse.receipts.manage');
      const id = await lockReceipt(tx, value);
      const r = await tx.warehouseReceipt.findUniqueOrThrow({
        where: { id },
        include: { lines: true },
      });
      if (r.source !== 'MANUAL')
        receiptConflict(
          'WAREHOUSE_RECEIPT_SOURCE',
          'Отмена 1С приходит через интеграцию.',
        );
      for (const l of r.lines)
        if ((await placedQuantity(tx, l.id)).gt(0))
          receiptConflict(
            'WAREHOUSE_RECEIPT_ALREADY_PLACED',
            'Размещение уже началось: физические движения не отменяются.',
          );
      await tx.warehouseReceipt.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await receiptAudit(this.audit, tx, actor, id, 'Отмена ручного прихода', {
        id: String(id),
      });
      return { id: String(id), status: 'CANCELLED' };
    });
  }
  findOne(value: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.warehouseReceipt.findUnique({
          where: { id: stockId(value, 'id') },
          include: receiptInclude,
        });
        if (!row)
          throw new NotFoundException({
            code: 'WAREHOUSE_RECEIPT_NOT_FOUND',
            message: 'Приход не найден.',
          });
        return receiptView(row, this.catalog, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
