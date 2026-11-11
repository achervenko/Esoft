import { Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import { moveReservation } from '../reservations/reservation-move';
import {
  reservationOrderDto,
  reservationOrderSelect,
} from '../reservations/reservations.dto';
import type { WarehouseStockService } from '../stock/stock.service';
import { stockError } from '../stock/stock.errors';
import type { parseTransfer } from './transfers.validation';
export async function applyTransferDistribution(
  tx: Prisma.TransactionClient,
  stock: WarehouseStockService,
  audit: AuditLogService,
  input: ReturnType<typeof parseTransfer>,
  actorUserId: string,
) {
  const distribution = input.distribution!;
  const reservations = await tx.warehouseReservation.findMany({
    where: {
      id: { in: distribution.reservations.map((r) => r.reservationId) },
    },
    include: { order: { select: reservationOrderSelect } },
  });
  if (
    reservations.length !== distribution.reservations.length ||
    reservations.some((r) => String(r.itemId) !== input.itemId)
  )
    stockError(
      409,
      'WAREHOUSE_TRANSFER_RESERVATION_INVALID',
      'Выбранные резервы не относятся к номенклатуре перемещения.',
    );
  const context = { tx, actorUserId };
  // Stock locks are already held by Transfers; the reservation kernel uses this transaction.
  if (new Prisma.Decimal(distribution.freeQuantity).gt(0))
    await stock.moveStock(
      context,
      input.itemId,
      input.fromLocationId,
      input.toLocationId,
      distribution.freeQuantity,
    );
  for (const row of distribution.reservations)
    await moveReservation(
      audit,
      stock,
      { ...context, comment: input.comment ?? undefined },
      {
        reservationId: row.reservationId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        quantity: row.quantity,
      },
    );
  return {
    freeQuantity: distribution.freeQuantity,
    reservations: distribution.reservations.map((row) => ({
      ...row,
      order: reservationOrderDto(
        reservations.find((r) => r.id === row.reservationId)!.order,
      ),
    })),
  };
}
