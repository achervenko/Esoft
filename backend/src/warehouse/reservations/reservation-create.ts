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
import { randomUUID } from 'node:crypto';
import { MAX_STOCK_QUANTITY, stockQuantity } from '../stock/stock.validation';

export type ReserveInput = {
  orderId: string;
  itemId: string;
  locationId: string;
  quantity: string | Prisma.Decimal;
};

export async function reserveStock(
  audit: AuditLogService,
  context: ReservationContext,
  input: ReserveInput,
) {
  const { tx, actorUserId, comment, receipt } = context;
  assertStockTransaction(tx);
  const quantity = stockQuantity(input.quantity);
  if (typeof input.orderId !== 'string' || !reservationUuid.test(input.orderId))
    stockError(
      400,
      'WAREHOUSE_RESERVATION_ORDER_ID_INVALID',
      'Некорректный ID заказа.',
    );
  const orderId = input.orderId.toLowerCase();
  await assertReadCommitted(tx);
  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!order)
    stockError(
      404,
      'WAREHOUSE_RESERVATION_ORDER_NOT_FOUND',
      'Заказ не найден.',
    );

  const {
    itemId,
    locationIds: [locationId],
    balances,
  } = await lockStockBalances(tx, input.itemId, [input.locationId]);
  const physical = balances.get(locationId)?.quantity ?? new Prisma.Decimal(0);
  const allocated = await tx.warehouseReservationAllocation.aggregate({
    where: { locationId, reservation: { itemId } },
    _sum: { quantity: true },
  });
  const free = Prisma.Decimal.max(
    0,
    physical.minus(allocated._sum.quantity ?? 0),
  );
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

  // The same order/item can be reserved concurrently at different locations.
  await lockReservation(tx, orderId, itemId);
  const orderItem = { orderId, itemId };
  const previous = await tx.warehouseReservation.findUnique({
    where: { orderId_itemId: orderItem },
  });
  const before = previous?.quantity ?? new Prisma.Decimal(0);
  const after = before.plus(quantity);
  if (after.gt(MAX_STOCK_QUANTITY))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_OVERFLOW',
      'Количество резерва превышает допустимый предел.',
    );
  const reservation = previous
    ? await tx.warehouseReservation.update({
        where: { id: previous.id },
        data: { quantity: after },
      })
    : await tx.warehouseReservation.create({
        data: { id: randomUUID(), ...orderItem, quantity: after },
      });
  const placement = { reservationId: reservation.id, locationId };
  const allocation = await tx.warehouseReservationAllocation.upsert({
    where: { reservationId_locationId: placement },
    create: { id: randomUUID(), ...placement, quantity },
    update: { quantity: { increment: quantity } },
  });
  await audit.writeFieldChanges({
    tx,
    userId: actorUserId,
    module: AuditModule.WAREHOUSE,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    entityType: 'warehouse_reservation',
    entityStringId: reservation.id,
    fields: [
      {
        fieldName: 'quantity',
        oldValue: before.toString(),
        newValue: {
          orderId,
          itemId: itemId.toString(),
          locationId: locationId.toString(),
          before: before.toString(),
          after: after.toString(),
          delta: quantity.toString(),
          allocationBefore: allocation.quantity.minus(quantity).toString(),
          allocationAfter: allocation.quantity.toString(),
          ...(comment ? { comment } : {}),
          ...(receipt ? { receipt } : {}),
        },
      },
    ],
  });
  return { reservation, allocation };
}
