import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { assertReservationAccess } from './reservations-access';
import { reservationOrderDto } from './reservations.dto';
import { parseReservationOrders } from './reservations.validation';

type OrderRow = {
  total: bigint;
  id: string | null;
  number: string;
  name: string;
  status: string;
  positionsCount: number;
  deficitPositionsCount: number;
};

export function listReservationOrders(
  prisma: PrismaService,
  value: unknown,
  actor: string,
) {
  const q = parseReservationOrders(value);
  const coverage =
    q.coverage === 'DEFICIT'
      ? Prisma.sql`stats."deficitPositionsCount" > 0`
      : q.coverage === 'COVERED'
        ? Prisma.sql`stats."deficitPositionsCount" = 0`
        : Prisma.sql`TRUE`;
  const search = q.search
    ? Prisma.sql`AND (
        strpos(lower(o.number), lower(${q.search})) > 0
        OR strpos(lower(o.name), lower(${q.search})) > 0
        OR EXISTS (
          SELECT 1 FROM warehouse_reservations matched
          JOIN warehouse_items i ON i.id = matched.item_id
          WHERE matched.order_id = o.id AND matched.quantity > 0
            AND (strpos(lower(i.article), lower(${q.search})) > 0
                 OR strpos(lower(i.name), lower(${q.search})) > 0)
        )
      )`
    : Prisma.empty;
  return prisma.$transaction(
    async (tx) => {
      await assertReservationAccess(tx, actor);
      const rows = await tx.$queryRaw<OrderRow[]>`
      WITH stats AS (
        SELECT r.order_id, COUNT(*)::int AS "positionsCount",
               COUNT(*) FILTER (WHERE r.quantity > COALESCE(a.quantity, 0))::int AS "deficitPositionsCount"
        FROM warehouse_reservations r
        LEFT JOIN (
          SELECT reservation_id, SUM(quantity) AS quantity
          FROM warehouse_reservation_allocations GROUP BY reservation_id
        ) a ON a.reservation_id = r.id
        WHERE r.quantity > 0 GROUP BY r.order_id
      ), filtered AS MATERIALIZED (
        SELECT o.id, o.number, o.name, o.status, stats."positionsCount", stats."deficitPositionsCount"
        FROM stats JOIN customer_orders o ON o.id = stats.order_id
        WHERE ${coverage} ${search}
      )
      SELECT totals.total, page.* FROM (SELECT COUNT(*) AS total FROM filtered) totals
      LEFT JOIN LATERAL (
        SELECT * FROM filtered ORDER BY number ASC, id ASC LIMIT ${q.limit} OFFSET ${q.skip}
      ) page ON TRUE
      ORDER BY page.number ASC, page.id ASC
    `;
      return {
        items: rows
          .filter((row) => row.id !== null)
          .map((row) => ({
            order: reservationOrderDto({
              id: row.id!,
              number: row.number,
              name: row.name,
              status: row.status,
            }),
            positionsCount: row.positionsCount,
            deficitPositionsCount: row.deficitPositionsCount,
          })),
        total: Number(rows[0].total),
        page: q.page,
        limit: q.limit,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
