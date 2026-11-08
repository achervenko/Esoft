import { AuditAction, AuditModule, type Prisma } from '@prisma/client';
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

export type ConsumeReservationInput = {
  reservationId: string;
  locationId: string;
  quantity: string | Prisma.Decimal;
};

export async function consumeReservation(
  audit: AuditLogService,
  stock: WarehouseStockService,
  context: ReservationContext & { actorUserId: string },
  input: ConsumeReservationInput,
) {
  const { tx, actorUserId } = context;
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

  const current = await tx.warehouseReservation.findUniqueOrThrow({
    where: { id },
    include: { allocations: true },
  });
  const placement = current.allocations.find(
    (row) => row.locationId === locationId,
  );
  if (!placement || quantity.gt(placement.quantity))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT',
      'Недостаточно резерва в месте хранения.',
      {
        locationId: input.locationId,
        available: placement?.quantity.toString() ?? '0',
      },
    );
  const { _sum } = await tx.warehouseReservationAllocation.aggregate({
    where: { locationId, reservation: { itemId } },
    _sum: { quantity: true },
  });
  if (_sum.quantity?.gt(balances.get(locationId)?.quantity ?? 0))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_STOCK_MISMATCH',
      'Физический остаток не покрывает размещённые резервы.',
      {
        locationId: input.locationId,
      },
    );

  const deficitQuantity = current.allocations.reduce(
    (remaining, row) => remaining.minus(row.quantity),
    current.quantity,
  );
  const reservationAfter = current.quantity.minus(quantity);
  const allocationAfter = placement.quantity.minus(quantity);
  const reservation = await tx.warehouseReservation.update({
    where: { id },
    data: { quantity: reservationAfter },
  });
  let allocation: typeof placement | null = null;
  if (allocationAfter.isZero())
    await tx.warehouseReservationAllocation.delete({
      where: { id: placement.id },
    });
  else
    allocation = await tx.warehouseReservationAllocation.update({
      where: { id: placement.id },
      data: { quantity: allocationAfter },
    });

  // Release only this placement before the ordinary free-stock check.
  await stock.issueStock(
    context,
    itemId.toString(),
    input.locationId,
    quantity,
  );

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
          operation: 'CONSUME',
          orderId,
          itemId: itemId.toString(),
          locationId: input.locationId,
          quantity: quantity.toString(),
          before: current.quantity.toString(),
          after: reservationAfter.toString(),
          allocationBefore: placement.quantity.toString(),
          allocationAfter: allocationAfter.toString(),
          deficitBefore: deficitQuantity.toString(),
          deficitAfter: deficitQuantity.toString(),
        },
      },
    ],
  });
  return { reservation, allocation, deficitQuantity };
}
