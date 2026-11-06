import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stockId } from '../stock/stock.validation';

export async function receiptReconciliationCandidates(
  tx: Prisma.TransactionClient,
  value: string,
) {
  const id = stockId(value, 'receiptId');
  const target = await tx.warehouseReceipt.findUnique({ where: { id } });
  if (!target)
    throw new NotFoundException({
      code: 'WAREHOUSE_RECEIPT_NOT_FOUND',
      message: 'Приход не найден.',
    });
  if (
    target.source !== 'ONE_C' ||
    !target.warehouseId ||
    target.conflict ||
    target.status === 'CANCELLED'
  )
    return { items: [] };
  const rows = await tx.$queryRaw<
    {
      id: bigint;
      document_number: string | null;
      document_date: Date | null;
      status: 'PLACING' | 'PLACED';
      same_number: boolean;
      same_items: boolean;
      same_quantities: boolean;
      matched_items: bigint;
      manual_items: bigint;
      date_distance: number | null;
    }[]
  >`
    WITH target_items AS (
      SELECT item_id, unit_snapshot, SUM(quantity) AS quantity
      FROM warehouse_receipt_lines WHERE receipt_id=${id} AND source_type='GOODS' AND item_id IS NOT NULL
      GROUP BY item_id, unit_snapshot
    ), candidates AS (
      SELECT r.id, r.document_number, r.document_date,r.status,
        NULLIF(lower(btrim(r.document_number)),'') = NULLIF(lower(btrim(${target.documentNumber}::text)),'') AS number_match,
        abs(r.document_date - ${target.documentDate}::date) AS date_distance
      FROM warehouse_receipts r
      WHERE r.source='MANUAL' AND r.status IN ('PLACING','PLACED') AND r.conflict IS NULL AND r.warehouse_id=${target.warehouseId}
        AND EXISTS(SELECT 1 FROM warehouse_receipt_lines l WHERE l.receipt_id=r.id)
        AND NOT EXISTS(SELECT 1 FROM warehouse_receipt_lines l WHERE l.receipt_id=r.id
          AND (l.reconciled_to_line_id IS NOT NULL OR l.item_id IS NULL OR l.source_type<>'GOODS'))
    ), eligible AS (
      SELECT c.* FROM candidates c
      WHERE c.number_match OR (c.date_distance<=7 AND EXISTS(
        SELECT 1 FROM warehouse_receipt_lines l JOIN target_items t
          ON t.item_id=l.item_id AND t.unit_snapshot=l.unit_snapshot WHERE l.receipt_id=c.id
      ))
    ), manual_items AS (
      SELECT l.receipt_id, l.item_id, l.unit_snapshot, SUM(l.quantity) AS quantity
      FROM warehouse_receipt_lines l JOIN eligible c ON c.id=l.receipt_id
      GROUP BY l.receipt_id,l.item_id,l.unit_snapshot
    ), compared AS (
      SELECT c.id,c.document_number,c.document_date,c.status,COALESCE(c.number_match,false) AS same_number,c.date_distance,
        COUNT(*) AS manual_items,COUNT(t.item_id) AS matched_items,
        COUNT(t.item_id)=COUNT(*) AND COUNT(*)=(SELECT COUNT(*) FROM target_items)
          AND NOT EXISTS(SELECT 1 FROM warehouse_receipt_lines WHERE receipt_id=${id} AND (source_type<>'GOODS' OR item_id IS NULL)) AS same_items,
        BOOL_AND(t.item_id IS NOT NULL AND t.quantity=m.quantity) AS quantities_match
      FROM eligible c JOIN manual_items m ON m.receipt_id=c.id
      LEFT JOIN target_items t ON t.item_id=m.item_id AND t.unit_snapshot=m.unit_snapshot
      GROUP BY c.id,c.document_number,c.document_date,c.status,c.number_match,c.date_distance
    )
    SELECT *,same_items AND quantities_match AS same_quantities FROM compared
    WHERE same_number OR (date_distance<=7 AND matched_items>0)
    ORDER BY same_number DESC,(same_items AND quantities_match) DESC,same_items DESC,matched_items DESC,date_distance,id DESC
    LIMIT 10
  `;
  return {
    items: rows.map((r) => ({
      id: String(r.id),
      status: r.status,
      documentNumber: r.document_number,
      documentDate: r.document_date?.toISOString().slice(0, 10) ?? null,
      sameNumber: r.same_number,
      sameItems: r.same_items,
      sameQuantities: r.same_quantities,
      matchedItems: Number(r.matched_items),
      manualItems: Number(r.manual_items),
      dateDistance: r.date_distance,
    })),
  };
}

/** Batched list hint, using the same eligibility rules as the detailed candidate search. */
export async function receiptReconciliationHints(
  tx: Prisma.TransactionClient,
  ids?: bigint[],
) {
  if (ids && !ids.length) return new Set<bigint>();
  const rows = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT t.id FROM warehouse_receipts t
    WHERE ${ids ? Prisma.sql`t.id IN (${Prisma.join(ids)})` : Prisma.sql`TRUE`} AND t.source='ONE_C'
      AND t.warehouse_id IS NOT NULL AND t.conflict IS NULL AND t.status<>'CANCELLED'
      AND EXISTS (
        SELECT 1 FROM warehouse_receipts m
        WHERE m.source='MANUAL' AND m.warehouse_id=t.warehouse_id
          AND m.status IN ('PLACING','PLACED') AND m.conflict IS NULL
          AND EXISTS(SELECT 1 FROM warehouse_receipt_lines l WHERE l.receipt_id=m.id)
          AND NOT EXISTS(SELECT 1 FROM warehouse_receipt_lines l WHERE l.receipt_id=m.id
            AND (l.reconciled_to_line_id IS NOT NULL OR l.item_id IS NULL OR l.source_type<>'GOODS'))
          AND (
            NULLIF(lower(btrim(m.document_number)),'')=NULLIF(lower(btrim(t.document_number)),'')
            OR (abs(m.document_date-t.document_date)<=7
              AND EXISTS (
                SELECT 1 FROM warehouse_receipt_lines ml
                JOIN warehouse_receipt_lines tl
                  ON tl.receipt_id=t.id AND tl.item_id=ml.item_id AND tl.unit_snapshot=ml.unit_snapshot
                WHERE ml.receipt_id=m.id AND tl.source_type='GOODS'
              ))
          )
      )`;
  return new Set(rows.map((row) => row.id));
}
