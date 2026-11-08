import { randomUUID } from 'node:crypto';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import { stockError } from '../stock/stock.errors';
import {
  assertStockTransaction,
  lockStockBalances,
} from '../stock/stock-locks';
import { stockId, stockQuantity } from '../stock/stock.validation';
import {
  assertReadCommitted,
  lockReservation,
  reservationUuid,
  type ReservationContext,
} from './reservation-common';

export type ReservationCoverageInput = {
  reservationId: string;
  locationId: string;
  quantity: string | Prisma.Decimal;
};

export async function changeReservationCoverage(
  audit: AuditLogService,
  { tx, actorUserId, comment }: ReservationContext,
  input: ReservationCoverageInput,
  operation: 'REDUCE_COVERAGE' | 'RESTORE_COVERAGE',
) {
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
  const locationId = stockId(input.locationId, 'locationId');
  const quantity = stockQuantity(input.quantity);
  await assertReadCommitted(tx);

  const identity = await tx.warehouseReservation.findUnique({
    where: { id },
    select: { orderId: true, itemId: true },
  });
  if (!identity)
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  const { orderId, itemId } = identity;
  const { balances } = await lockStockBalances(tx, itemId.toString(), [
    input.locationId,
  ]);
  await lockReservation(tx, orderId, itemId);
  const { allocations, ...reservation } =
    await tx.warehouseReservation.findUniqueOrThrow({
      where: { id },
      include: { allocations: true },
    });
  const deficitBefore = allocations.reduce(
    (remaining, allocation) => remaining.minus(allocation.quantity),
    reservation.quantity,
  );
  const current = allocations.find(
    (allocation) => allocation.locationId === locationId,
  );
  const before = current?.quantity ?? new Prisma.Decimal(0);
  const restoring = operation === 'RESTORE_COVERAGE';

  if (restoring) {
    if (quantity.gt(deficitBefore))
      stockError(
        409,
        'WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT',
        'Недостаточно необеспеченного количества.',
        {
          available: deficitBefore.toString(),
        },
      );
    const physical =
      balances.get(locationId)?.quantity ?? new Prisma.Decimal(0);
    const { _sum } = await tx.warehouseReservationAllocation.aggregate({
      where: { locationId, reservation: { itemId } },
      _sum: { quantity: true },
    });
    const free = Prisma.Decimal.max(0, physical.minus(_sum.quantity ?? 0));
    if (quantity.gt(free))
      stockError(
        409,
        'WAREHOUSE_RESERVATION_INSUFFICIENT',
        'Недостаточно свободного остатка.',
        {
          available: free.toString(),
          requested: quantity.toString(),
        },
      );
  } else if (quantity.gt(before)) {
    stockError(
      409,
      'WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT',
      'Недостаточно резерва в месте хранения.',
      {
        locationId: locationId.toString(),
        available: before.toString(),
      },
    );
  }

  const delta = restoring ? quantity : quantity.negated();
  const after = before.plus(delta);
  const deficitQuantity = deficitBefore.minus(delta);
  const placement = { reservationId: id, locationId };
  const where = { reservationId_locationId: placement };
  let allocation: typeof current | null = null;
  if (after.isZero()) await tx.warehouseReservationAllocation.delete({ where });
  else
    allocation = await tx.warehouseReservationAllocation.upsert({
      where,
      create: { id: randomUUID(), ...placement, quantity: after },
      update: { quantity: after },
    });

  await audit.writeFieldChanges({
    tx,
    userId: actorUserId,
    module: AuditModule.WAREHOUSE,
    action: AuditAction.UPDATE,
    entityType: 'warehouse_reservation',
    entityStringId: id,
    fields: [
      {
        fieldName: 'allocations',
        oldValue: before.toString(),
        newValue: {
          operation,
          orderId,
          itemId: itemId.toString(),
          locationId: locationId.toString(),
          quantity: quantity.toString(),
          reservationQuantity: reservation.quantity.toString(),
          allocationBefore: before.toString(),
          allocationAfter: after.toString(),
          deficitBefore: deficitBefore.toString(),
          deficitAfter: deficitQuantity.toString(),
          ...(comment ? { comment } : {}),
        },
      },
    ],
  });
  return { reservation, allocation, deficitQuantity };
}
