import type { WarehouseReceipt, WarehouseReceiptLine } from '@prisma/client';
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

export async function invoicePlacementOrder(
  tx: Tx,
  receipt: WarehouseReceipt,
  line: WarehouseReceiptLine,
) {
  if (!importedInvoiceId(receipt))
    return receipt.source === 'MANUAL' ? line.orderId : null;
  if (line.orderSnapshot === null) return null;
  const snapshot = line.orderSnapshot;
  if (
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    typeof snapshot.id !== 'string'
  )
    receiptConflict(
      'WAREHOUSE_RECEIPT_ORDER_UNRESOLVED',
      'Не удалось сопоставить заказ 1С.',
    );
  const order = await tx.customerOrder.findUnique({
    where: { externalId: snapshot.id },
    select: { id: true },
  });
  if (!order)
    receiptConflict(
      'WAREHOUSE_RECEIPT_ORDER_UNRESOLVED',
      'Заказ 1С ещё не синхронизирован.',
    );
  if (line.orderId !== order.id)
    await tx.warehouseReceiptLine.update({
      where: { id: line.id },
      data: { orderId: order.id },
    });
  return order.id;
}
