import { Prisma } from '@prisma/client';

type StockPair = { itemId: bigint; storageLocationId: bigint };
export const stockPairKey = (row: StockPair) =>
  `${row.itemId}:${row.storageLocationId}`;

export function stockQuantityDto(
  quantity: Prisma.Decimal,
  reservedQuantity = new Prisma.Decimal(0),
) {
  return {
    reservedQuantity: reservedQuantity.toString(),
    freeQuantity: Prisma.Decimal.max(
      0,
      quantity.minus(reservedQuantity),
    ).toString(),
    reservationMismatch: reservedQuantity.gt(quantity),
  };
}

// Only pairs in the requested page/distribution are aggregated; no order data is loaded.
export async function readReservedQuantities(
  tx: Prisma.TransactionClient,
  balances: StockPair[],
) {
  const pairs = [
    ...new Map(balances.map((row) => [stockPairKey(row), row])).values(),
  ];
  if (!pairs.length) return new Map<string, Prisma.Decimal>();
  const rows = await tx.$queryRaw<
    { item_id: bigint; location_id: bigint; quantity: Prisma.Decimal }[]
  >`
    WITH selected(item_id, location_id) AS (
      VALUES ${Prisma.join(pairs.map((row) => Prisma.sql`(${row.itemId}::bigint, ${row.storageLocationId}::bigint)`))}
    )
    SELECT s.item_id, s.location_id, SUM(a.quantity) AS quantity
    FROM selected s
    JOIN warehouse_reservation_allocations a ON a.location_id = s.location_id
    JOIN warehouse_reservations r ON r.id = a.reservation_id AND r.item_id = s.item_id
    GROUP BY s.item_id, s.location_id
  `;
  return new Map(
    rows.map((row) => [`${row.item_id}:${row.location_id}`, row.quantity]),
  );
}

export type StockGroup = { itemId: bigint; warehouseId: bigint | null };
export const stockGroupKey = (row: StockGroup) =>
  `${row.itemId}:${row.warehouseId}`;

export async function readStockGroupQuantities(
  tx: Prisma.TransactionClient,
  groups: StockGroup[],
) {
  if (!groups.length)
    return new Map<
      string,
      {
        quantity: string;
        reservedQuantity: string;
        freeQuantity: string;
        reservationMismatch: boolean;
      }
    >();
  const rows = await tx.$queryRaw<
    {
      item_id: bigint;
      warehouse_id: bigint | null;
      quantity: Prisma.Decimal;
      reserved: Prisma.Decimal;
      free: Prisma.Decimal;
      mismatch: boolean;
    }[]
  >`
    WITH selected(item_id, warehouse_id) AS (
      VALUES ${Prisma.join(groups.map((row) => Prisma.sql`(${row.itemId}::bigint, ${row.warehouseId}::bigint)`))}
    )
    SELECT s.item_id, s.warehouse_id,
      COALESCE(SUM(b.quantity),0) AS quantity,
      COALESCE(SUM(a.quantity),0) AS reserved,
      COALESCE(SUM(GREATEST(b.quantity - COALESCE(a.quantity,0),0)),0) AS free,
      COALESCE(BOOL_OR(a.quantity > b.quantity),false) AS mismatch
    FROM selected s
    LEFT JOIN (warehouse_balances b JOIN warehouse_storage_locations l ON l.id=b.storage_location_id)
      ON b.item_id=s.item_id AND (s.warehouse_id IS NULL OR l.warehouse_id=s.warehouse_id)
    LEFT JOIN LATERAL (
      SELECT SUM(ra.quantity) AS quantity
      FROM warehouse_reservation_allocations ra JOIN warehouse_reservations r ON r.id=ra.reservation_id
      WHERE ra.location_id=b.storage_location_id AND r.item_id=b.item_id
    ) a ON TRUE
    GROUP BY s.item_id,s.warehouse_id
  `;
  return new Map(
    rows.map((row) => [
      `${row.item_id}:${row.warehouse_id}`,
      {
        quantity: row.quantity.toString(),
        reservedQuantity: row.reserved.toString(),
        freeQuantity: row.free.toString(),
        reservationMismatch: row.mismatch,
      },
    ]),
  );
}
