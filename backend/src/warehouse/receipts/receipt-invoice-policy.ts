import type { WarehouseReceipt, WarehouseReceiptLine } from '@prisma/client';
import { reservationUuid } from '../reservations/reservation-common';
import { lockInvoiceSnapshot } from '../invoice-snapshot-lock';
import { receiptConflict, type Tx } from './receipts.policy';

export function importedInvoiceId(
  receipt: Pick<WarehouseReceipt, 'source' | 'sourceOperationId'>,
) {
  if (receipt.source !== 'ONE_C') return null;
  const match = /^invoice:([0-9a-f-]{36}):[0-9a-f-]{36}$/.exec(
    receipt.sourceOperationId,
  );
  return match?.[1] ?? null;
}

export async function lockInvoiceBeforeReceipt(tx: Tx, receiptId: bigint) {
  const receipt = await tx.warehouseReceipt.findUnique({
    where: { id: receiptId },
    select: { source: true, sourceOperationId: true },
  });
  const invoiceId = receipt ? importedInvoiceId(receipt) : null;
  // Import takes the snapshot lock before locking any receipt rows.
  if (invoiceId) await lockInvoiceSnapshot(tx, invoiceId);
  return invoiceId ? receipt!.sourceOperationId : null;
}

export async function assertInvoiceReceiptAvailable(
  tx: Tx,
  receipt: WarehouseReceipt,
  lockedOperationId: string | null,
) {
  const invoiceId = importedInvoiceId(receipt);
  if ((invoiceId ? receipt.sourceOperationId : null) !== lockedOperationId)
    receiptConflict(
      'WAREHOUSE_RECEIPT_BLOCKED',
      'Связь прихода с накладной 1С изменилась.',
    );
  if (!invoiceId) return;
  const [snapshot] = await tx.$queryRaw<{ available: boolean }[]>`
    SELECT s.payload->>'status'='POSTED' AND s.result->>'outcome'='PROCESSED'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.result->'groups') AS g
        WHERE g->>'operationId'=${receipt.sourceOperationId} AND g->>'status'='IMPORTED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.result->'groups') AS g
        WHERE g->>'status'='CONFLICT'
      ) AS available
    FROM warehouse_invoice_snapshots s
    WHERE s.invoice_id=${invoiceId}::uuid`;
  if (!snapshot?.available)
    receiptConflict(
      'WAREHOUSE_RECEIPT_BLOCKED',
      'Актуальная накладная 1С не допущена к размещению.',
    );
}

type PlacementOrderLine = Pick<
  WarehouseReceiptLine,
  'id' | 'orderId' | 'orderSnapshot'
>;
type PlacementOrderReceipt = Pick<
  WarehouseReceipt,
  'source' | 'sourceOperationId'
>;

function placementOrderReference(
  receipt: PlacementOrderReceipt,
  line: PlacementOrderLine,
) {
  if (!importedInvoiceId(receipt))
    return receipt.source === 'MANUAL' && line.orderId
      ? { orderId: line.orderId }
      : null;
  const snapshot = line.orderSnapshot;
  if (snapshot === null) return null;
  if (
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    typeof snapshot.id !== 'string' ||
    !reservationUuid.test(snapshot.id)
  )
    return { invalid: true } as const;
  return { externalId: snapshot.id.toLowerCase() };
}

export async function readPlacementOrders(
  tx: Tx,
  receipt: PlacementOrderReceipt,
  lines: readonly PlacementOrderLine[],
) {
  const references = lines.map((line) => ({
    lineId: line.id,
    reference: placementOrderReference(receipt, line),
  }));
  const externalIds = [
    ...new Set(
      references.flatMap(({ reference }) =>
        reference?.externalId ? [reference.externalId] : [],
      ),
    ),
  ];
  const orders = new Map<string, string>();
  for (let start = 0; start < externalIds.length; start += 1000) {
    const batch = await tx.customerOrder.findMany({
      where: { externalId: { in: externalIds.slice(start, start + 1000) } },
      select: { id: true, externalId: true },
    });
    for (const order of batch) orders.set(order.externalId, order.id);
  }
  return references.map(({ lineId, reference }) => ({
    lineId,
    orderId: reference?.externalId
      ? (orders.get(reference.externalId) ?? null)
      : (reference?.orderId ?? null),
    error: reference?.invalid
      ? 'Не удалось сопоставить заказ 1С.'
      : reference?.externalId && !orders.has(reference.externalId)
        ? 'Заказ 1С ещё не синхронизирован.'
        : null,
  }));
}

export async function invoicePlacementOrder(
  tx: Tx,
  receipt: WarehouseReceipt,
  line: WarehouseReceiptLine,
) {
  const [{ orderId, error }] = await readPlacementOrders(tx, receipt, [line]);
  if (error) receiptConflict('WAREHOUSE_RECEIPT_ORDER_UNRESOLVED', error);
  if (orderId && line.orderId !== orderId)
    await tx.warehouseReceiptLine.update({
      where: { id: line.id },
      data: { orderId },
    });
  return orderId;
}
