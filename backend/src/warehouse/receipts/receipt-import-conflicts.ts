import {
  Prisma,
  type WarehouseReceipt,
  type WarehouseReceiptLine,
} from '@prisma/client';
import type { SourceReceipt } from './receipts-import.contract';
import { placedQuantity, type Tx } from './receipts.policy';

export async function receiptImportConflict(
  tx: Tx,
  input: SourceReceipt,
  previous: WarehouseReceipt | null,
  oldLines: WarehouseReceiptLine[],
): Promise<string | null> {
  let hasPlacements = false,
    conflict: string | null = null;
  for (const old of oldLines) {
    const placed = await placedQuantity(tx, old.id);
    if (placed.isZero()) continue;
    hasPlacements = true;
    const next = input.lines.find((l) => l.id === old.externalLineId);
    if (
      !next ||
      next.item.id !== old.externalItemId ||
      next.item.unit !== old.unitSnapshot ||
      next.item.type !== 'GOODS' ||
      new Prisma.Decimal(next.quantity).lt(placed)
    )
      conflict = 'SOURCE_LINES_CHANGED_AFTER_PLACEMENT';
  }
  if (hasPlacements && previous?.externalWarehouseId !== input.warehouse.id)
    conflict = 'SOURCE_WAREHOUSE_CHANGED_AFTER_PLACEMENT';
  if (hasPlacements && input.status === 'CANCELLED')
    conflict = 'SOURCE_CANCELLED_AFTER_PLACEMENT';
  if (
    previous &&
    input.status === 'POSTED' &&
    (await tx.warehouseStockAdjustment.count({
      where: { resolvedReceiptId: previous.id },
    })) > 0
  )
    // Historical placements cannot fulfil a new receipt after stock settlement.
    conflict = 'SOURCE_REPOSTED_AFTER_SETTLEMENT';
  return conflict;
}
