import {
  Prisma,
  type WarehouseReceipt,
  type WarehouseReceiptLine,
} from '@prisma/client';
import type { SourceReceipt } from './receipts-import.contract';
import type { Tx } from './receipts.policy';
import {
  externalOneCUuid,
  receiptWarehouseExternalId,
} from './receipt-warehouse-links';

function orderIdentity(id: string | null) {
  return id && externalOneCUuid.test(id) ? id.toLowerCase() : id;
}

function savedOrderIdentity(snapshot: Prisma.JsonValue) {
  return orderIdentity(
    snapshot &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot) &&
      typeof snapshot.id === 'string'
      ? snapshot.id
      : null,
  );
}

export async function receiptImportConflict(
  tx: Tx,
  input: SourceReceipt,
  previous: WarehouseReceipt | null,
  oldLines: WarehouseReceiptLine[],
): Promise<string | null> {
  const placements = oldLines.length
    ? await tx.$queryRaw<{ expectedId: bigint; quantity: Prisma.Decimal }[]>`
      SELECT expected.id AS "expectedId", SUM(p.quantity)::numeric AS quantity
      FROM warehouse_receipt_lines expected
      JOIN warehouse_receipt_lines actual
        ON actual.id=expected.id OR actual.reconciled_to_line_id=expected.id
      JOIN warehouse_receipt_placements p ON p.receipt_line_id=actual.id
      WHERE expected.id IN (${Prisma.join(oldLines.map((line) => line.id))})
      GROUP BY expected.id HAVING SUM(p.quantity)>0`
    : [];
  const hasPlacements = placements.length > 0;
  let conflict: string | null = null;
  const oldById = new Map(oldLines.map((line) => [line.id, line]));
  const nextById = new Map(input.lines.map((line) => [line.id, line]));
  for (const { expectedId, quantity: placed } of placements) {
    const old = oldById.get(expectedId);
    const next = old && nextById.get(old.externalLineId);
    if (
      !old ||
      !next ||
      next.item.id !== old.externalItemId ||
      next.item.unit !== old.unitSnapshot ||
      next.item.type !== 'GOODS' ||
      orderIdentity(next.order?.id ?? null) !==
        savedOrderIdentity(old.orderSnapshot) ||
      new Prisma.Decimal(next.quantity).lt(placed)
    )
      conflict = 'SOURCE_LINES_CHANGED_AFTER_PLACEMENT';
  }
  if (
    hasPlacements &&
    receiptWarehouseExternalId(previous?.externalWarehouseId ?? '') !==
      receiptWarehouseExternalId(input.warehouse.id)
  )
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
