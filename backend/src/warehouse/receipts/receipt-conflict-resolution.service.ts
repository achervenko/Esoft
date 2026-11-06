import { stockId } from '../stock/stock.validation';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { Prisma } from '@prisma/client';
import {
  lockReceipt,
  receiptActor,
  receiptAudit,
  receiptConflict,
} from './receipts.policy';
import { invalid, record, text } from './receipts.validation';
@Injectable()
export class WarehouseReceiptConflictResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}
  resolve(receiptValue: string, value: unknown, actor: string) {
    const b = record(value, [
        'action',
        'reason',
        'sourceVersion',
        'adjustmentIds',
      ]),
      reason = text(b.reason, 4000),
      version = text(b.sourceVersion, 30);
    if (
      ![
        'KEEP_CURRENT',
        'ACCEPT_CANCELLATION',
        'RECONCILE_CANCELLATION',
      ].includes(String(b.action))
    )
      invalid('Неизвестное решение конфликта.');
    const reconcile = b.action === 'RECONCILE_CANCELLATION';
    if (
      reconcile &&
      (!Array.isArray(b.adjustmentIds) ||
        b.adjustmentIds.length < 1 ||
        b.adjustmentIds.length > 100)
    )
      invalid('Укажите от 1 до 100 проведённых корректировок.');
    if (!reconcile && b.adjustmentIds !== undefined)
      invalid('Корректировки допустимы только для согласования отмены.');
    const adjustmentIds = reconcile
      ? (b.adjustmentIds as unknown[]).map((id) => stockId(id, 'adjustmentId'))
      : [];
    if (new Set(adjustmentIds.map(String)).size !== adjustmentIds.length)
      invalid('Корректировки не должны повторяться.');
    return this.prisma.$transaction(async (tx) => {
      await receiptActor(tx, actor, 'integrations.manage');
      const id = await lockReceipt(tx, receiptValue);
      const r = await tx.warehouseReceipt.findUniqueOrThrow({ where: { id } });
      if (
        !r.conflict ||
        !r.pendingPayload ||
        r.sourceVersion?.toString() !== version
      )
        receiptConflict(
          'WAREHOUSE_RECEIPT_CONFLICT_STALE',
          'Конфликт уже изменён или отсутствует.',
        );
      if (
        b.action !== 'KEEP_CURRENT' &&
        r.conflict !== 'SOURCE_CANCELLED_AFTER_PLACEMENT'
      )
        invalid('Текущий конфликт не является отменой.');
      if (reconcile) {
        await receiptActor(tx, actor, 'warehouse.adjustments.manage');
        const adjustments = await tx.$queryRaw<
          {
            id: bigint;
            resolved_receipt_id: bigint | null;
            related: boolean;
            created_at: Date;
          }[]
        >`
          SELECT a.id, a.resolved_receipt_id, a.created_at,
            EXISTS(SELECT 1 FROM warehouse_receipt_placements p JOIN warehouse_receipt_lines l ON l.id=p.receipt_line_id
              WHERE p.storage_location_id=b.storage_location_id AND l.item_id=b.item_id
              AND (l.receipt_id=${id} OR l.reconciled_to_line_id IN (SELECT id FROM warehouse_receipt_lines WHERE receipt_id=${id}))) AS related
          FROM warehouse_stock_adjustments a JOIN warehouse_balances b ON b.id=a.balance_id
          WHERE a.id IN (${Prisma.join(adjustmentIds)}) FOR UPDATE OF a`;
        if (
          adjustments.length !== adjustmentIds.length ||
          adjustments.some(
            (a) =>
              a.resolved_receipt_id !== null ||
              !a.related ||
              a.created_at < r.receivedAt,
          )
        )
          receiptConflict(
            'WAREHOUSE_RECEIPT_ADJUSTMENT_INVALID',
            'Корректировка должна относиться к размещённому товару и месту, быть проведена после получения конфликта и не использоваться ранее для согласования.',
          );
        await tx.warehouseStockAdjustment.updateMany({
          where: { id: { in: adjustmentIds }, resolvedReceiptId: null },
          data: { resolvedReceiptId: id },
        });
      }
      await receiptAudit(
        this.audit,
        tx,
        actor,
        id,
        'Ручное решение конфликта',
        {
          action: String(b.action),
          reason,
          sourceVersion: version,
          ...(reconcile ? { adjustmentIds: adjustmentIds.map(String) } : {}),
          ...(b.action === 'KEEP_CURRENT'
            ? { rejectedSource: r.pendingPayload }
            : { acceptedSource: r.pendingPayload }),
        },
      );
      await tx.warehouseReceipt.update({
        where: { id },
        data: {
          conflict: null,
          pendingPayload: Prisma.DbNull,
          ...(b.action !== 'KEEP_CURRENT'
            ? { status: 'CANCELLED', sourcePayload: r.pendingPayload }
            : {}),
        },
      });
      return { id: String(id) };
    });
  }
}
