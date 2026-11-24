import { WarehouseNotificationsService } from '../warehouse-notifications.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { Prisma } from '@prisma/client';
import {
  lockReceipt,
  receiptActor,
  receiptAudit,
  receiptConflict,
  type Tx,
} from './receipts.policy';
import { lockStockBalances } from '../stock/stock-locks';
import {
  readReservedQuantities,
  readStockGroupQuantities,
  stockGroupKey,
} from '../stock/stock-quantities';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { invalid, record, text } from './receipts.validation';

async function checkCancellationStock(
  tx: Tx,
  id: bigint,
  warehouseId: bigint | null,
) {
  if (warehouseId === null) invalid('Для прихода не указан склад.');
  await lockWarehouse(tx, warehouseId);
  const required = await tx.$queryRaw<
    { itemId: bigint; name: string; unit: string; quantity: Prisma.Decimal }[]
  >`
    SELECT i.id AS "itemId", i.name, i.unit, SUM(p.quantity) AS quantity
    FROM warehouse_receipt_lines expected
    JOIN warehouse_receipt_lines actual
      ON actual.id = expected.id OR actual.reconciled_to_line_id = expected.id
    JOIN warehouse_receipt_placements p ON p.receipt_line_id = actual.id
    JOIN warehouse_items i ON i.id = actual.item_id
    WHERE expected.receipt_id = ${id}
    GROUP BY i.id
    ORDER BY i.id`;
  const locations = await tx.warehouseStorageLocation.findMany({
    where: { warehouseId },
    select: { id: true },
  });
  const locationIds = locations.map(({ id }) => String(id));
  const withoutBalances: { itemId: bigint; storageLocationId: bigint }[] = [];
  for (const { itemId } of required) {
    if (!locationIds.length) break;
    const locked = await lockStockBalances(tx, String(itemId), locationIds);
    for (const storageLocationId of locked.locationIds)
      if (!locked.balances.has(storageLocationId))
        withoutBalances.push({ itemId, storageLocationId });
  }

  const groups = required.map(({ itemId }) => ({ itemId, warehouseId }));
  const totals = await readStockGroupQuantities(tx, groups);
  // Location creation can run under the same warehouse SHARE lock.
  if (
    await tx.warehouseStorageLocation.findFirst({
      where: { warehouseId, id: { notIn: locations.map(({ id }) => id) } },
      select: { id: true },
    })
  )
    receiptConflict(
      'WAREHOUSE_RECEIPT_CANCELLATION_LOCATIONS_CHANGED',
      'Список мест хранения изменился. Повторите подтверждение отмены.',
    );
  const shortages = required.flatMap(({ itemId, name, unit, quantity }) => {
    const total = totals.get(stockGroupKey({ itemId, warehouseId }));
    const physical = new Prisma.Decimal(total?.quantity ?? 0);
    return physical.lt(quantity)
      ? [
          {
            itemId: String(itemId),
            name,
            unit,
            required: quantity.toString(),
            physical: physical.toString(),
            shortage: quantity.minus(physical).toString(),
          },
        ]
      : [];
  });
  if (shortages.length)
    receiptConflict(
      'WAREHOUSE_RECEIPT_CANCELLATION_STOCK_INSUFFICIENT',
      'На складе недостаточно товара для принятия отмены.',
      { shortages },
    );
  if (
    [...totals.values()].some(
      ({ reservationMismatch }) => reservationMismatch,
    ) ||
    [...(await readReservedQuantities(tx, withoutBalances)).values()].some(
      (quantity) => quantity.gt(0),
    )
  )
    receiptConflict(
      'WAREHOUSE_RESERVATION_STOCK_MISMATCH',
      'Физический остаток не покрывает размещённые резервы.',
    );
}

@Injectable()
export class WarehouseReceiptConflictResolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifications: WarehouseNotificationsService,
  ) {}
  resolve(receiptValue: string, value: unknown, actor: string) {
    const b = record(value, ['action', 'reason', 'sourceVersion']);
    const reason = text(b.reason, 4000);
    const version = text(b.sourceVersion, 30);
    if (b.action !== 'KEEP_CURRENT' && b.action !== 'ACCEPT_CANCELLATION')
      invalid('Неизвестное решение конфликта.');
    return this.prisma.$transaction(
      async (tx) => {
        await receiptActor(tx, actor, 'warehouse.receipts.resolve');
        const id = await lockReceipt(tx, receiptValue);
        const r = await tx.warehouseReceipt.findUniqueOrThrow({
          where: { id },
        });
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
        if (b.action === 'ACCEPT_CANCELLATION')
          await checkCancellationStock(tx, id, r.warehouseId);
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
        await this.notifications.receipt(tx, id);
        return { id: String(id) };
      },
      {
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
