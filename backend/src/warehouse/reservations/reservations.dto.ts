import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { CLOSED_ORDER_STATUS } from '../../orders/orders.constants';
import {
  warehouseItemSummaryDto,
  warehouseItemSummarySelect,
} from '../catalog/catalog.dto';
import { stockError } from '../stock/stock.errors';
import {
  locationWithWarehouseDto,
  locationWithWarehouseSelect,
} from '../storage-structure/storage-structure.dto';

export const reservationOrderSelect = {
  id: true,
  number: true,
  name: true,
  status: true,
} satisfies Prisma.CustomerOrderSelect;

export function reservationOrderDto(
  order: Prisma.CustomerOrderGetPayload<{
    select: typeof reservationOrderSelect;
  }>,
) {
  const closed = order.status === CLOSED_ORDER_STATUS;
  return {
    ...order,
    closed,
    warnings: closed
      ? [{ code: 'ORDER_CLOSED', message: 'Заказ закрыт.' }]
      : [],
  };
}

export const reservationInclude = {
  order: { select: reservationOrderSelect },
  item: { select: warehouseItemSummarySelect },
  allocations: {
    orderBy: { locationId: 'asc' },
    include: { location: { select: locationWithWarehouseSelect } },
  },
} satisfies Prisma.WarehouseReservationInclude;

export function reservationDto(
  row: Prisma.WarehouseReservationGetPayload<{
    include: typeof reservationInclude;
  }>,
) {
  const covered = row.allocations.reduce(
    (sum, entry) => sum.plus(entry.quantity),
    new Prisma.Decimal(0),
  );
  const order = reservationOrderDto(row.order);
  return {
    id: row.id,
    order,
    item: warehouseItemSummaryDto(row.item),
    quantity: row.quantity.toString(),
    coveredQuantity: covered.toString(),
    deficitQuantity: row.quantity.minus(covered).toString(),
    allocations: row.allocations.map((entry) => ({
      id: entry.id,
      location: locationWithWarehouseDto(entry.location),
      quantity: entry.quantity.toString(),
    })),
    warnings: order.warnings,
  };
}

export async function readReservation(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const row = await tx.warehouseReservation.findUnique({
    where: { id },
    include: reservationInclude,
  });
  if (!row)
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  return reservationDto(row);
}

export const reservationAuditWhere = (id: string) => ({
  module: AuditModule.WAREHOUSE,
  entityType: 'warehouse_reservation',
  entityStringId: id,
});

export function reservationHistoryDto(
  row: Prisma.AuditLogGetPayload<Record<string, never>>,
) {
  const details = JSON.parse(row.newValue ?? '{}') as Record<string, unknown>;
  return {
    id: row.id,
    reservationId: row.entityStringId,
    createdAt: row.createdAt,
    userId: row.userId,
    operation:
      details.operation ??
      (row.action === AuditAction.CREATE ? 'CREATE' : 'INCREASE'),
    details,
  };
}
