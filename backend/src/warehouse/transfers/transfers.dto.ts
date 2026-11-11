import type { WarehouseTransfer } from '@prisma/client';
export function transferDto(row: WarehouseTransfer) {
  return {
    id: String(row.id),
    itemId: String(row.itemId),
    fromLocationId: String(row.fromLocationId),
    toLocationId: String(row.toLocationId),
    quantity: row.quantity.toString(),
    comment: row.comment,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    requestKey: row.requestKey,
    snapshot: row.snapshot,
  };
}
