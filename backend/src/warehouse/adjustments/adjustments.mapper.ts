import type { Prisma } from '@prisma/client';
import { toStorageFileDto } from '../../storage/storage-file.mapper';

export const adjustmentInclude = {
  balance: { include: { item: true, storageLocation: true } },
  attachments: { include: { file: true }, orderBy: { fileId: 'asc' as const } },
} satisfies Prisma.WarehouseStockAdjustmentInclude;
type Adjustment = Prisma.WarehouseStockAdjustmentGetPayload<{
  include: typeof adjustmentInclude;
}>;

export function toAdjustmentDto(row: Adjustment) {
  return {
    id: row.id.toString(),
    itemId: row.balance.itemId.toString(),
    locationId: row.balance.storageLocationId.toString(),
    balanceId: row.balanceId.toString(),
    type: row.type,
    quantity: row.quantity.toString(),
    quantityBefore: row.quantityBefore.toString(),
    quantityAfter: row.quantityAfter.toString(),
    reason: row.reason,
    comment: row.comment,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    requestKey: row.requestKey,
    attachments: row.attachments.map(({ file }) => toStorageFileDto(file)),
  };
}
