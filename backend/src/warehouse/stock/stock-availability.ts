import { Prisma } from '@prisma/client';
import { stockError } from './stock.errors';
import { assertStockTransaction } from './stock-locks';
import type { StockBalance } from './stock.types';

export async function assertStockReadCommitted(tx: Prisma.TransactionClient) {
  assertStockTransaction(tx);
  const [row] = await tx.$queryRaw<{ level: string }[]>`
    SELECT current_setting('transaction_isolation') AS level
  `;
  // Stock locks do not refresh a transaction snapshot taken before a reservation committed.
  if (row.level !== 'read committed')
    stockError(
      400,
      'WAREHOUSE_STOCK_ISOLATION_REQUIRED',
      'Изменение остатков требует транзакцию ReadCommitted.',
    );
}

export async function stockAvailability(
  tx: Prisma.TransactionClient,
  itemId: bigint,
  locationId: bigint,
  balance: StockBalance | undefined,
) {
  const { _sum } = await tx.warehouseReservationAllocation.aggregate({
    where: { locationId, reservation: { itemId } },
    _sum: { quantity: true },
  });
  const physical = balance?.quantity ?? new Prisma.Decimal(0);
  const reserved = _sum.quantity ?? new Prisma.Decimal(0);
  return {
    physical,
    reserved,
    free: Prisma.Decimal.max(0, physical.minus(reserved)),
  };
}

type Availability = Awaited<ReturnType<typeof stockAvailability>>;

function details(
  { physical, reserved, free }: Availability,
  itemId: string,
  locationId: string,
) {
  return {
    itemId,
    locationId,
    physical: physical.toString(),
    reserved: reserved.toString(),
    free: free.toString(),
  };
}

export function assertStockCoverage(
  availability: Availability,
  itemId: string,
  locationId: string,
) {
  if (availability.reserved.gt(availability.physical))
    stockError(
      409,
      'WAREHOUSE_RESERVATION_STOCK_MISMATCH',
      'Физический остаток не покрывает размещённые резервы.',
      details(availability, itemId, locationId),
    );
}

export function assertFreeStock(
  availability: Availability,
  itemId: string,
  locationId: string,
  requested: Prisma.Decimal,
) {
  if (requested.gt(availability.free))
    stockError(
      409,
      'WAREHOUSE_STOCK_RESERVED',
      'Недостаточно свободного остатка: часть материала зарезервирована.',
      {
        ...details(availability, itemId, locationId),
        requested: requested.toString(),
      },
    );
}
