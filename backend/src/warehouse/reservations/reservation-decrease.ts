import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import { stockError } from '../stock/stock.errors';
import {
  assertStockTransaction,
  lockStockBalances,
} from '../stock/stock-locks';
import {
  assertReadCommitted,
  lockReservation,
  reservationUuid,
  type ReservationContext,
} from './reservation-common';
import { stockId, stockQuantity } from '../stock/stock.validation';

export type DecreaseReservationInput = {
  reservationId: string;
  allocations: { locationId: string; quantity: string | Prisma.Decimal }[];
  deficitQuantity: string | Prisma.Decimal;
};

export async function decreaseReservation(
  audit: AuditLogService,
  context: ReservationContext,
  input: DecreaseReservationInput,
) {
  const { tx, actorUserId, comment } = context;
  assertStockTransaction(tx);
  if (
    typeof input.reservationId !== 'string' ||
    !reservationUuid.test(input.reservationId)
  )
    stockError(
      400,
      'WAREHOUSE_RESERVATION_ID_INVALID',
      'Некорректный ID резерва.',
    );
  const id = input.reservationId.toLowerCase();
  const deficitQuantity = stockQuantity(input.deficitQuantity, true);
  const quantities = new Map<bigint, Prisma.Decimal>();
  let decreaseBy = deficitQuantity;
  for (const entry of input.allocations) {
    const locationId = stockId(entry.locationId, 'locationId');
    if (quantities.has(locationId))
      stockError(
        400,
        'WAREHOUSE_RESERVATION_DUPLICATE_LOCATION',
        'Место хранения указано повторно.',
      );
    const quantity = stockQuantity(entry.quantity);
    quantities.set(locationId, quantity);
    decreaseBy = decreaseBy.plus(quantity);
  }
  stockQuantity(decreaseBy);
  await assertReadCommitted(tx);

  const identity = await tx.warehouseReservation.findUnique({
    where: { id },
    select: { orderId: true, itemId: true },
  });
  if (!identity)
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  const { orderId, itemId } = identity;
  if (quantities.size)
    await lockStockBalances(
      tx,
      itemId.toString(),
      [...quantities.keys()].map(String),
    );
  await lockReservation(tx, orderId, itemId);
  const current = await tx.warehouseReservation.findUniqueOrThrow({
    where: { id },
    include: { allocations: { orderBy: { locationId: 'asc' } } },
  });
  const allocated = current.allocations.reduce(
    (sum, row) => sum.plus(row.quantity),
    new Prisma.Decimal(0),
  );
  const deficitBefore = current.quantity.minus(allocated);
  if (deficitQuantity.gt(deficitBefore))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT',
      'Недостаточно необеспеченного количества.',
      {
        available: deficitBefore.toString(),
      },
    );

  const byLocation = new Map(
    current.allocations.map((row) => [row.locationId, row]),
  );
  const changes = [...quantities].map(([locationId, quantity]) => {
    const row = byLocation.get(locationId);
    if (!row || quantity.gt(row.quantity))
      stockError(
        409,
        'WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT',
        'Недостаточно резерва в месте хранения.',
        {
          locationId: locationId.toString(),
          available: row?.quantity.toString() ?? '0',
        },
      );
    return { row, after: row.quantity.minus(quantity) };
  });
  for (const { row, after } of changes) {
    if (after.isZero())
      await tx.warehouseReservationAllocation.delete({
        where: { id: row.id },
      });
    else
      await tx.warehouseReservationAllocation.update({
        where: { id: row.id },
        data: { quantity: after },
      });
  }
  const after = current.quantity.minus(decreaseBy);
  const reservation = await tx.warehouseReservation.update({
    where: { id },
    data: { quantity: after },
    include: { allocations: { orderBy: { locationId: 'asc' } } },
  });
  const deficitAfter = deficitBefore.minus(deficitQuantity);
  await audit.writeFieldChanges({
    tx,
    userId: actorUserId,
    module: AuditModule.WAREHOUSE,
    action: AuditAction.UPDATE,
    entityType: 'warehouse_reservation',
    entityStringId: id,
    fields: [
      {
        fieldName: 'quantity',
        oldValue: current.quantity.toString(),
        newValue: {
          operation: after.isZero() ? 'RELEASE' : 'DECREASE',
          orderId,
          itemId: itemId.toString(),
          before: current.quantity.toString(),
          after: after.toString(),
          delta: decreaseBy.negated().toString(),
          deficitBefore: deficitBefore.toString(),
          deficitAfter: deficitAfter.toString(),
          ...(comment ? { comment } : {}),
          allocations: changes.map(({ row, after }) => ({
            locationId: row.locationId.toString(),
            before: row.quantity.toString(),
            after: after.toString(),
          })),
        },
      },
    ],
  });
  return { reservation, deficitQuantity: deficitAfter };
}
