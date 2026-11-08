import { randomUUID } from 'node:crypto';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import { stockError } from '../stock/stock.errors';
import {
  assertStockTransaction,
  lockStockBalances,
} from '../stock/stock-locks';
import type { WarehouseStockService } from '../stock/stock.service';
import { stockId, stockQuantity } from '../stock/stock.validation';
import {
  assertReadCommitted,
  lockReservation,
  reservationUuid,
  type ReservationContext,
} from './reservation-common';

export type MoveReservationInput = {
  reservationId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: string | Prisma.Decimal;
};

export async function moveReservation(
  audit: AuditLogService,
  stock: WarehouseStockService,
  { tx, actorUserId }: ReservationContext & { actorUserId: string },
  input: MoveReservationInput,
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
  const quantity = stockQuantity(input.quantity);
  const fromId = stockId(input.fromLocationId, 'fromLocationId');
  const toId = stockId(input.toLocationId, 'toLocationId');
  if (fromId === toId)
    stockError(
      400,
      'WAREHOUSE_STOCK_SAME_LOCATION',
      'Исходное и целевое места должны различаться.',
    );
  await assertReadCommitted(tx);

  const identity = await tx.warehouseReservation.findUnique({
    where: { id },
    select: { orderId: true, itemId: true },
  });
  if (!identity)
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  const { orderId, itemId } = identity;
  const { balances, locationIds } = await lockStockBalances(
    tx,
    itemId.toString(),
    [input.fromLocationId, input.toLocationId],
  );
  await lockReservation(tx, orderId, itemId);
  const { allocations, ...reservation } =
    await tx.warehouseReservation.findUniqueOrThrow({
      where: { id },
      include: { allocations: true },
    });
  const from = allocations.find((row) => row.locationId === fromId);
  const to = allocations.find((row) => row.locationId === toId);
  if (!from || quantity.gt(from.quantity))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT',
      'Недостаточно резерва в месте хранения.',
      {
        locationId: fromId.toString(),
        available: from?.quantity.toString() ?? '0',
      },
    );

  const totals = await tx.warehouseReservationAllocation.groupBy({
    by: ['locationId'],
    where: { locationId: { in: locationIds }, reservation: { itemId } },
    _sum: { quantity: true },
  });
  for (const { locationId, _sum } of totals)
    if (_sum.quantity?.gt(balances.get(locationId)?.quantity ?? 0))
      stockError(
        409,
        'WAREHOUSE_RESERVATION_STOCK_MISMATCH',
        'Физический остаток не покрывает размещённые резервы.',
        {
          locationId: locationId.toString(),
        },
      );

  const fromAfter = from.quantity.minus(quantity);
  const toBefore = to?.quantity ?? new Prisma.Decimal(0);
  const toAfter = toBefore.plus(quantity);
  const deficit = allocations.reduce(
    (remaining, allocation) => remaining.minus(allocation.quantity),
    reservation.quantity,
  );

  let fromAllocation: typeof from | null = null;
  if (fromAfter.isZero())
    await tx.warehouseReservationAllocation.delete({ where: { id: from.id } });
  else
    fromAllocation = await tx.warehouseReservationAllocation.update({
      where: { id: from.id },
      data: { quantity: fromAfter },
    });
  // Free the source first; allocate the destination after the physical transfer.
  await stock.moveStock(
    { tx, actorUserId },
    itemId.toString(),
    input.fromLocationId,
    input.toLocationId,
    quantity,
  );
  const toAllocation = to
    ? await tx.warehouseReservationAllocation.update({
        where: { id: to.id },
        data: { quantity: toAfter },
      })
    : await tx.warehouseReservationAllocation.create({
        data: {
          id: randomUUID(),
          reservationId: id,
          locationId: toId,
          quantity: toAfter,
        },
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
        newValue: {
          operation: 'MOVE',
          orderId,
          itemId: itemId.toString(),
          quantity: quantity.toString(),
          reservationQuantity: reservation.quantity.toString(),
          deficitQuantity: deficit.toString(),
          from: {
            locationId: fromId.toString(),
            before: from.quantity.toString(),
            after: fromAfter.toString(),
          },
          to: {
            locationId: toId.toString(),
            before: toBefore.toString(),
            after: toAfter.toString(),
          },
        },
      },
    ],
  });
  return { reservation, fromAllocation, toAllocation };
}
