import type { invoiceSnapshot } from './one-c-invoice-snapshot';

type Invoice = ReturnType<typeof invoiceSnapshot>;
type InvoiceLine = Invoice['lines'][number];

export function groupInvoiceLinesByWarehouse(invoice: Invoice) {
  const groups = new Map<
    string,
    {
      operationId: string;
      warehouse: InvoiceLine['warehouse'];
      lines: InvoiceLine[];
    }
  >();
  for (const line of invoice.lines) {
    if (line.item.type !== 'Товар') continue;
    const warehouseId = line.warehouse.id;
    const group = groups.get(warehouseId);
    if (group) group.lines.push(line);
    else
      groups.set(warehouseId, {
        operationId: `invoice:${invoice.id}:${warehouseId}`,
        warehouse: line.warehouse,
        lines: [line],
      });
  }
  return [...groups.values()];
}
