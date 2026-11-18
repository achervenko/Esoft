import { Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import type { ReceiptImportGroup } from './receipts-import.contract';
import { receiptAudit, type Tx } from './receipts.policy';
import { receiptHash } from './receipts.validation';

export function existingGroups(tx: Tx, invoiceId: string) {
  const prefix = 'invoice:' + invoiceId + ':';
  return tx.$queryRaw<ReceiptImportGroup[]>`
      SELECT id, source_operation_id AS "sourceOperationId", external_warehouse_id AS "externalWarehouseId",
        source_payload AS "sourcePayload", source_version AS "sourceVersion", status, conflict
      FROM warehouse_receipts
      WHERE source='ONE_C'
        AND starts_with(source_operation_id,${prefix})
      ORDER BY id FOR UPDATE`;
}

export function findLegacyReceipt(tx: Tx, invoiceId: string) {
  return tx.warehouseReceipt.findFirst({
    where: {
      source: 'ONE_C',
      sourceOperationId: { equals: invoiceId, mode: 'insensitive' },
    },
    select: { id: true },
  });
}

export async function placedGroups(tx: Tx, receipts: ReceiptImportGroup[]) {
  const rows = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT DISTINCT expected.receipt_id AS id
      FROM warehouse_receipt_placements p
      JOIN warehouse_receipt_lines actual ON actual.id=p.receipt_line_id
      JOIN warehouse_receipt_lines expected ON expected.id=COALESCE(actual.reconciled_to_line_id,actual.id)
      WHERE expected.receipt_id IN (${Prisma.join(receipts.map(({ id }) => id))})`;
  return new Set(rows.map(({ id }) => id));
}

export async function suspend(
  audit: AuditLogService,
  tx: Tx,
  actorUserId: string,
  receipt: ReceiptImportGroup,
  conflict: string | null,
  invoice: { id: string; status: string },
) {
  if (
    conflict
      ? receipt.conflict === conflict
      : receipt.status === 'CANCELLED' && !receipt.conflict
  )
    return;
  const version = (receipt.sourceVersion ?? 0n) + 1n;
  const pending = {
    ...(receipt.sourcePayload as Prisma.JsonObject),
    status: 'CANCELLED',
    version: String(version),
    lines: [],
  };
  await tx.warehouseReceipt.update({
    where: { id: receipt.id },
    data: {
      sourceVersion: version,
      requestHash: receiptHash(pending),
      receivedAt: new Date(),
      conflict,
      pendingPayload: conflict ? pending : Prisma.DbNull,
      ...(conflict ? {} : { status: 'CANCELLED' }),
    },
  });
  await receiptAudit(
    audit,
    tx,
    actorUserId,
    receipt.id,
    'Приёмка накладной 1С приостановлена',
    { invoiceId: invoice.id, status: invoice.status, conflict },
  );
}

export async function refreshInvoiceReceiptOrders(tx: Tx, receiptId: bigint) {
  await tx.$executeRaw`
          UPDATE warehouse_receipt_lines l
          SET order_id=o.id
          FROM customer_orders o
          WHERE l.receipt_id=${receiptId}
            AND o.external_id=(l.order_snapshot->>'id')::uuid
            AND l.order_id IS DISTINCT FROM o.id`;
}
