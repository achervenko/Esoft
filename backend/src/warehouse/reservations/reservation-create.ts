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
import {
  MAX_STOCK_QUANTITY,
  stockId,
  stockQuantity,
} from '../stock/stock.validation';

export type ReserveInput = {
  orderId: string;
  itemId: string;
  locationId?: string;
  coveredQuantity?: string | Prisma.Decimal;
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
  const covered =
    input.coveredQuantity === undefined
      ? input.locationId
        ? quantity
        : new Prisma.Decimal(0)
      : stockQuantity(input.coveredQuantity, true);
  if (
    covered.gt(quantity) ||
    covered.isZero() !== (input.locationId === undefined)
  )
    stockError(
      400,
      'WAREHOUSE_RESERVATION_INVALID',
      'Некорректная обеспеченная часть резерва.',
    );
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

  const itemId = stockId(input.itemId, 'itemId');
  let locationId: bigint | undefined;
  if (input.locationId !== undefined) {
    const { locationIds, balances } = await lockStockBalances(
      tx,
      input.itemId,
      [input.locationId],
    );
    locationId = locationIds[0];
    const physical =
      balances.get(locationId)?.quantity ?? new Prisma.Decimal(0);
    const allocated = await tx.warehouseReservationAllocation.aggregate({
      where: { locationId, reservation: { itemId } },
      _sum: { quantity: true },
    });
    const free = Prisma.Decimal.max(
      0,
      physical.minus(allocated._sum.quantity ?? 0),
    );
    if (covered.gt(free))
      stockError(
        409,
        'WAREHOUSE_RESERVATION_INSUFFICIENT',
        'Недостаточно свободного остатка.',
        {
          available: free.toString(),
          requested: covered.toString(),
        },
      );
  } else {
    const [item] = await tx.$queryRaw<
      { id: bigint; is_active: boolean }[]
    >`SELECT id, is_active FROM warehouse_items WHERE id = ${itemId} FOR SHARE`;
    if (!item)
      stockError(404, 'WAREHOUSE_ITEM_NOT_FOUND', 'Номенклатура не найдена.');
    if (!item.is_active)
      stockError(
        409,
        'WAREHOUSE_RESERVATION_INACTIVE_REFERENCE',
        'Номенклатура неактивна.',
      );
  }

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
  const placement =
    locationId === undefined
      ? null
      : { reservationId: reservation.id, locationId };
  const allocation =
    placement &&
    (await tx.warehouseReservationAllocation.upsert({
      where: { reservationId_locationId: placement },
      create: { id: randomUUID(), ...placement, quantity: covered },
      update: { quantity: { increment: covered } },
    }));
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
          ...(allocation
            ? {
                locationId: allocation.locationId.toString(),
                allocationBefore: allocation.quantity.minus(covered).toString(),
                allocationAfter: allocation.quantity.toString(),
              }
            : {}),
          before: before.toString(),
          after: after.toString(),
          delta: quantity.toString(),
          ...(comment ? { comment } : {}),
          ...(receipt ? { receipt } : {}),
        },
      },
    ],
  });
  return { reservation, allocation };
}
