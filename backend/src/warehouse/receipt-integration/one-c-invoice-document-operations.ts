import type {
  ReceiptImportGroup,
  ReceiptImportTransaction as Tx,
} from '../receipts/receipts-import.contract';
import type { WarehouseReceiptImportService } from '../receipts/receipt-import.service';
import { groupPayload, groupResult } from './one-c-invoice-document-groups';
import type {
  Group,
  GroupResult,
  Invoice,
  InvoiceImportSource,
} from './one-c-invoice-document-types';

export async function suspendInvoiceGroups(
  importer: WarehouseReceiptImportService,
  tx: Tx,
  source: InvoiceImportSource,
  previous: ReceiptImportGroup[],
  placed: ReadonlySet<bigint>,
  desired: ReadonlyMap<string, Group>,
  invoice: Invoice,
) {
  const results: GroupResult[] = [];
  for (const receipt of previous) {
    const conflict = placed.has(receipt.id)
      ? invoice.status === 'CANCELED'
        ? 'SOURCE_CANCELLED_AFTER_PLACEMENT'
        : invoice.status === 'CREATED'
          ? 'SOURCE_INVOICE_UNPOSTED_AFTER_PLACEMENT'
          : 'SOURCE_LINES_CHANGED_AFTER_PLACEMENT'
      : null;
    await importer.suspendInvoiceGroup(
      tx,
      source.actorUserId,
      receipt,
      conflict,
      invoice,
    );
    results.push({
      operationId: receipt.sourceOperationId,
      warehouseId: receipt.externalWarehouseId ?? '',
      rows: (desired.get(receipt.sourceOperationId)?.lines ?? []).map(
        (line) => line.rowNumber,
      ),
      status: conflict ? 'CONFLICT' : 'SUSPENDED',
      ...(conflict ? { conflict } : {}),
    });
  }
  return results;
}

export async function findInvoiceOrders(tx: Tx, eligible: Group[]) {
  const orderIds = [
    ...new Set(
      eligible.flatMap((group) =>
        group.lines.flatMap((line) => (line.order ? [line.order.id] : [])),
      ),
    ),
  ];
  const orders = new Map<string, string>();
  for (let offset = 0; offset < orderIds.length; offset += 1000) {
    const rows = await tx.customerOrder.findMany({
      where: {
        externalId: { in: orderIds.slice(offset, offset + 1000) },
      },
      select: { id: true, externalId: true },
    });
    for (const row of rows)
      if (row.externalId) orders.set(row.externalId, row.id);
  }
  return orders;
}

export async function importInvoiceGroup(
  importer: WarehouseReceiptImportService,
  tx: Tx,
  source: InvoiceImportSource,
  invoice: Invoice,
  group: Group,
  orders: ReadonlyMap<string, string>,
) {
  const result = await importer.applySnapshot(
    tx,
    source.code,
    groupPayload(invoice, group),
    source.actorUserId,
    { matches: orders },
  );
  const diagnostic = groupResult(
    group,
    result.conflict ? 'CONFLICT' : 'IMPORTED',
  );
  if (result.conflict) diagnostic.conflict = result.conflict;
  const missingOrders = [
    ...new Set(
      group.lines.flatMap((line) =>
        line.order && !orders.has(line.order.id) ? [line.order.id] : [],
      ),
    ),
  ];
  if (missingOrders.length) {
    diagnostic.missingOrders = missingOrders;
    diagnostic.code = 'WAREHOUSE_RECEIPT_ORDER_UNRESOLVED';
  }
  if (!result.conflict) {
    await importer.refreshInvoiceReceiptOrders(tx, BigInt(result.id));
  }
  return diagnostic;
}
