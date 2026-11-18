import {
  receiptHash,
  type ReceiptImportTransaction as Tx,
} from '../receipts/receipts-import.contract';
import { lockInvoiceSnapshot } from '../invoice-snapshot-lock';
import type { Invoice } from './one-c-invoice-document-types';

export async function saveInvoiceSnapshot(
  tx: Tx,
  source: { id: string; code: string },
  invoice: Invoice,
  observedAt: Date,
  receivedAt: Date,
) {
  await lockInvoiceSnapshot(tx, invoice.id);
  const hash = receiptHash(invoice);
  // Current state and the appended revision share the same commit.
  const [result] = await tx.$queryRaw<{ saved: boolean }[]>`
    WITH prior AS (
      SELECT payload_hash, observed_at FROM warehouse_invoice_snapshots
      WHERE invoice_id=${invoice.id}::uuid
    ), current_snapshot AS (
      INSERT INTO warehouse_invoice_snapshots
        (source_id,invoice_id,observed_at,received_at,payload_hash,payload,version)
      VALUES (${source.id}::uuid,${invoice.id}::uuid,${observedAt},${receivedAt},
              ${hash},${JSON.stringify(invoice)}::jsonb,1)
      ON CONFLICT(invoice_id) DO UPDATE SET
        observed_at=excluded.observed_at,
        received_at=excluded.received_at,
        version=warehouse_invoice_snapshots.version +
          CASE WHEN warehouse_invoice_snapshots.payload_hash<>excluded.payload_hash THEN 1 ELSE 0 END,
        payload_hash=excluded.payload_hash,payload=excluded.payload,result=NULL
      WHERE warehouse_invoice_snapshots.observed_at<excluded.observed_at
      RETURNING invoice_id,version,received_at,payload_hash,payload
    ), appended AS (
      INSERT INTO warehouse_invoice_snapshot_versions
        (invoice_id,version,detected_at,payload_hash,payload)
      SELECT invoice_id,version,received_at,payload_hash,payload
      FROM current_snapshot
      WHERE NOT EXISTS (SELECT 1 FROM prior WHERE prior.payload_hash=current_snapshot.payload_hash)
    )
    SELECT EXISTS (SELECT 1 FROM current_snapshot)
        OR EXISTS (SELECT 1 FROM prior WHERE observed_at=${observedAt} AND payload_hash=${hash})
      AS saved`;
  return result.saved;
}
