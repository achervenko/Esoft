import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { stockId } from '../stock/stock.validation';
import {
  lockReceipt,
  placedQuantity,
  receiptActor,
  receiptAudit,
  receiptConflict,
  receiptProgress,
} from './receipts.policy';
import { invalid, record } from './receipts.validation';
@Injectable()
export class WarehouseReceiptReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}
  reconcile(receiptValue: string, value: unknown, actor: string) {
    const b = record(value, ['manualReceiptId', 'lines']);
    const manualId = stockId(b.manualReceiptId, 'manualReceiptId'),
      targetId = stockId(receiptValue, 'receiptId');
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100)
      invalid('Укажите соответствие строк.');
    const pairs = b.lines.map((v) => {
      const l = record(v, ['manualLineId', 'receiptLineId']);
      return {
        manualLineId: stockId(l.manualLineId, 'manualLineId'),
        receiptLineId: stockId(l.receiptLineId, 'receiptLineId'),
      };
    });
    if (new Set(pairs.map((p) => String(p.manualLineId))).size !== pairs.length)
      invalid('Ручная строка указана повторно.');
    return this.prisma.$transaction(
      async (tx) => {
        await receiptActor(tx, actor, 'warehouse.receipts.map');
        for (const id of [manualId, targetId].sort((a, b) => (a < b ? -1 : 1)))
          await lockReceipt(tx, String(id));
        const target = await tx.warehouseReceipt.findUniqueOrThrow({
            where: { id: targetId },
            include: { lines: true },
          }),
          manual = await tx.warehouseReceipt.findUniqueOrThrow({
            where: { id: manualId },
            include: { lines: true },
          });
        if (
          target.source !== 'ONE_C' ||
          manual.source !== 'MANUAL' ||
          manual.status !== 'PLACED' ||
          target.status === 'CANCELLED' ||
          target.conflict ||
          manual.warehouseId === null ||
          manual.warehouseId !== target.warehouseId
        )
          receiptConflict(
            'WAREHOUSE_RECEIPT_RECONCILIATION_INVALID',
            'Нужен полностью размещённый ручной приход на том же складе и действующий документ 1С без конфликта.',
          );
        if (pairs.length !== manual.lines.length)
          invalid('Нужно сопоставить все строки ручного прихода.');
        for (const pair of pairs) {
          const from = manual.lines.find((l) => l.id === pair.manualLineId),
            to = target.lines.find((l) => l.id === pair.receiptLineId);
          if (
            !from ||
            !to ||
            !to.itemId ||
            from.itemId !== to.itemId ||
            from.unitSnapshot !== to.unitSnapshot ||
            to.sourceType !== 'GOODS'
          )
            receiptConflict(
              'WAREHOUSE_RECEIPT_RECONCILIATION_INVALID',
              'Не совпадают товары или единицы строк.',
            );
          if (from.reconciledToLineId) {
            if (from.reconciledToLineId === to.id) continue;
            receiptConflict(
              'WAREHOUSE_RECEIPT_ALREADY_RECONCILED',
              'Строка уже связана с другим приходом.',
            );
          }
          const placed = await placedQuantity(tx, to.id),
            manualPlaced = await placedQuantity(tx, from.id);
          if (placed.plus(manualPlaced).gt(to.quantity))
            receiptConflict(
              'WAREHOUSE_RECEIPT_OVERPLACEMENT',
              'Связь превышает количество документа 1С.',
            );
          await tx.warehouseReceiptLine.update({
            where: { id: from.id },
            data: { reconciledToLineId: to.id },
          });
        }
        await receiptProgress(tx, targetId);
        await receiptAudit(
          this.audit,
          tx,
          actor,
          targetId,
          'Связан ручной приход',
          {
            manualReceiptId: String(manualId),
            lines: pairs.map((p) => ({
              manualLineId: String(p.manualLineId),
              receiptLineId: String(p.receiptLineId),
            })),
          },
        );
        return {
          receiptId: String(targetId),
          manualReceiptId: String(manualId),
        };
      },
      { timeout: 15000 },
    );
  }
}
