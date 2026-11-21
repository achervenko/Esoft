import type { Prisma } from '@prisma/client';
import { stockError } from '../stock/stock.errors';

export type ReservationContext = {
  tx: Prisma.TransactionClient;
  actorUserId?: string;
  comment?: string;
  receipt?: {
    receiptId: string;
    receiptLineId: string;
    restoredQuantity: string;
    increasedQuantity: string;
  };
};
export const reservationUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function assertReadCommitted(tx: Prisma.TransactionClient) {
  const [isolation] = await tx.$queryRaw<{ level: string }[]>`
    SELECT current_setting('transaction_isolation') AS level
  `;
  // A transaction snapshot taken before waiting for a lock can miss allocations.
  if (isolation.level !== 'read committed')
    stockError(
      400,
      'WAREHOUSE_RESERVATION_ISOLATION_REQUIRED',
      'Резервирование требует транзакцию ReadCommitted.',
    );
}

export async function lockReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  itemId: bigint,
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`warehouse:reservation:${orderId}:${itemId}`}, 0))
  `;
}

export function reservationDeficit(reservation: {
  quantity: Prisma.Decimal;
  allocations: readonly { quantity: Prisma.Decimal }[];
}) {
  return reservation.allocations.reduce(
    (remaining, allocation) => remaining.minus(allocation.quantity),
    reservation.quantity,
  );
}

export async function readReservationDeficits(
  tx: Prisma.TransactionClient,
  pairs: readonly { orderId: string; itemId: bigint }[],
) {
  const unique = [
    ...new Map(
      pairs.map((pair) => [`${pair.orderId}:${pair.itemId}`, pair]),
    ).values(),
  ];
  const deficits = new Map<string, string>();
  for (let start = 0; start < unique.length; start += 1000) {
    const reservations = await tx.warehouseReservation.findMany({
      where: { OR: unique.slice(start, start + 1000) },
      select: {
        orderId: true,
        itemId: true,
        quantity: true,
        allocations: { select: { quantity: true } },
      },
    });
    for (const reservation of reservations) {
      const deficit = reservationDeficit(reservation);
      if (deficit.gt(0))
        deficits.set(
          `${reservation.orderId}:${reservation.itemId}`,
          deficit.toString(),
        );
    }
  }
  return deficits;
}
