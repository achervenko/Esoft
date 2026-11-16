import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import { stockError } from '../stock/stock.errors';
import { lockStockBalances } from '../stock/stock-locks';
import {
  assertReadCommitted,
  lockReservation,
  type ReservationContext,
} from './reservation-common';
import { changeReservationCoverage } from './reservation-coverage';

export type DemandIncreaseInput = {
  reservationId: string;
  expectedQuantity: Prisma.Decimal;
  target: Prisma.Decimal;
  allocation?: { locationId: string; quantity: Prisma.Decimal };
};

export async function increaseReservationDemand(
  audit: AuditLogService,
  context: ReservationContext,
  { reservationId, expectedQuantity, target, allocation }: DemandIncreaseInput,
) {
  const { tx, actorUserId, comment } = context;
  await assertReadCommitted(tx);
  const where = { id: reservationId };
  const identity = await tx.warehouseReservation.findUnique({
    where,
    select: { orderId: true, itemId: true },
  });
  if (!identity)
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  if (allocation)
    await lockStockBalances(tx, String(identity.itemId), [
      allocation.locationId,
    ]);
  await lockReservation(tx, identity.orderId, identity.itemId);
  const current = await tx.warehouseReservation.findUniqueOrThrow({ where });
  if (!current.quantity.eq(expectedQuantity) || !target.gt(current.quantity))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_STALE_DEMAND',
      'Потребность изменилась. Обновите резерв.',
    );
  const reservation = await tx.warehouseReservation.update({
    where,
    data: { quantity: target },
  });
  await audit.writeFieldChanges({
    tx,
    userId: actorUserId,
    module: AuditModule.WAREHOUSE,
    action: AuditAction.UPDATE,
    entityType: 'warehouse_reservation',
    entityStringId: reservationId,
    fields: [
      {
        fieldName: 'quantity',
        oldValue: current.quantity.toString(),
        newValue: {
          operation: 'INCREASE_DEMAND',
          orderId: identity.orderId,
          itemId: String(identity.itemId),
          before: current.quantity.toString(),
          after: target.toString(),
          ...(comment ? { comment } : {}),
        },
      },
    ],
  });
  if (allocation)
    await changeReservationCoverage(
      audit,
      context,
      { reservationId, ...allocation },
      'RESTORE_COVERAGE',
    );
  return { reservation };
}
