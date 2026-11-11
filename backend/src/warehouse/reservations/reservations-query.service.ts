import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockError } from '../stock/stock.errors';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { assertReservationAccess } from './reservations-access';
import { listReservationOrders } from './reservation-orders-query';
import {
  readReservation,
  reservationAuditWhere,
  reservationDto,
  reservationHistoryDto,
  reservationInclude,
  reservationOrderDto,
  reservationOrderSelect,
} from './reservations.dto';
import {
  parseReservationHistory,
  parseReservationList,
  parseReservationUuid,
} from './reservations.validation';

const snapshot = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
};

@Injectable()
export class WarehouseReservationQueryService {
  constructor(private readonly prisma: PrismaService) {}

  orders(value: unknown, actor: string) {
    return listReservationOrders(this.prisma, value, actor);
  }

  summary(value: string, actor: string) {
    const id = parseReservationUuid(value, 'orderId');
    return this.prisma.$transaction(async (tx) => {
      await assertReservationAccess(tx, actor);
      const order = await tx.customerOrder.findUnique({
        where: { id },
        select: reservationOrderSelect,
      });
      if (!order)
        stockError(
          404,
          'WAREHOUSE_RESERVATION_ORDER_NOT_FOUND',
          'Заказ не найден.',
        );
      const [counts] = await tx.$queryRaw<
        { positions: bigint; deficit: bigint }[]
      >`
        SELECT COUNT(*) AS positions, COUNT(*) FILTER (
          WHERE r.quantity > COALESCE((SELECT SUM(a.quantity) FROM warehouse_reservation_allocations a WHERE a.reservation_id = r.id), 0)
        ) AS deficit FROM warehouse_reservations r WHERE r.order_id = ${id}::uuid AND r.quantity > 0
      `;
      return {
        order: reservationOrderDto(order),
        positionsCount: Number(counts.positions),
        deficitPositionsCount: Number(counts.deficit),
      };
    }, snapshot);
  }

  list(value: unknown, actor: string) {
    const q = parseReservationList(value);
    const filters = [Prisma.sql`TRUE`];
    if (q.search)
      filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM warehouse_items i WHERE i.id = r.item_id
      AND (strpos(lower(i.article), lower(${q.search})) > 0 OR strpos(lower(i.name), lower(${q.search})) > 0)
    )`);
    if (q.orderId !== undefined)
      filters.push(Prisma.sql`r.order_id = ${q.orderId}::uuid`);
    if (q.itemId !== undefined)
      filters.push(Prisma.sql`r.item_id = ${q.itemId}`);
    if (q.quantityState === 'POSITIVE')
      filters.push(Prisma.sql`r.quantity > 0`);
    if (q.quantityState === 'ZERO') filters.push(Prisma.sql`r.quantity = 0`);
    if (q.covered !== undefined)
      filters.push(Prisma.sql`
      EXISTS (SELECT 1 FROM warehouse_reservation_allocations a WHERE a.reservation_id = r.id AND a.quantity > 0) = ${q.covered}
    `);
    if (q.deficit !== undefined)
      filters.push(Prisma.sql`
      (r.quantity > COALESCE((SELECT SUM(a.quantity) FROM warehouse_reservation_allocations a WHERE a.reservation_id = r.id), 0)) = ${q.deficit}
    `);
    const where = Prisma.join(filters, ' AND ');
    return this.prisma.$transaction(async (tx) => {
      await assertReservationAccess(tx, actor);
      const [{ total }] = await tx.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS total FROM warehouse_reservations r WHERE ${where}
      `;
      const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT r.id FROM warehouse_reservations r WHERE ${where}
        ORDER BY r.created_at DESC, r.id DESC LIMIT ${q.limit} OFFSET ${q.skip}
      `;
      const items = await tx.warehouseReservation.findMany({
        where: { id: { in: ids.map(({ id }) => id) } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: reservationInclude,
      });
      return {
        items: items.map(reservationDto),
        total: Number(total),
        page: q.page,
        limit: q.limit,
      };
    }, snapshot);
  }

  get(value: string, actor: string) {
    const id = parseReservationUuid(value, 'reservationId');
    return this.prisma.$transaction(async (tx) => {
      await assertReservationAccess(tx, actor);
      return readReservation(tx, id);
    }, snapshot);
  }

  order(value: string, actor: string) {
    const id = parseReservationUuid(value, 'orderId');
    return this.prisma.$transaction(async (tx) => {
      await assertReservationAccess(
        tx,
        actor,
        WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE,
      );
      const order = await tx.customerOrder.findUnique({
        where: { id },
        select: reservationOrderSelect,
      });
      if (!order)
        stockError(
          404,
          'WAREHOUSE_RESERVATION_ORDER_NOT_FOUND',
          'Заказ не найден.',
        );
      return reservationOrderDto(order);
    }, snapshot);
  }

  history(value: string, query: unknown, actor: string) {
    const id = parseReservationUuid(value, 'reservationId');
    const { page, limit, skip } = parseReservationHistory(query);
    return this.prisma.$transaction(async (tx) => {
      await assertReservationAccess(tx, actor);
      if (
        !(await tx.warehouseReservation.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
      const where = reservationAuditWhere(id);
      const rows = await tx.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      });
      return {
        items: rows.map(reservationHistoryDto),
        total: await tx.auditLog.count({ where }),
        page,
        limit,
      };
    }, snapshot);
  }
}
