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
