import { groupInvoiceLinesByWarehouse } from './one-c-invoice-groups';
import type { invoiceSnapshot } from './one-c-invoice-snapshot';

it('keeps separate groups by external warehouse UUID and preserves original row numbers', () => {
  const invoice: ReturnType<typeof invoiceSnapshot> = {
    id: 'f79d68f2-7ec9-47cd-9fa4-086a5df8e8f7',
    number: '100',
    date: '2026-11-14T10:00:00',
    status: 'POSTED',
    lines: ['a', 'b', 'a'].map((id, index) => ({
      rowNumber: index + 1,
      warehouse: { id, name: 'Same name' },
      item: {
        id: 'item',
        article: '',
        name: 'Item',
        unit: 'шт',
        type: 'Товар',
      },
      quantity: '1',
      order: null,
    })),
  };
  const groups = groupInvoiceLinesByWarehouse(invoice);
  expect(groups.map((group) => group.operationId)).toEqual([
    `invoice:${invoice.id}:a`,
    `invoice:${invoice.id}:b`,
  ]);
  expect(
    groups.map((group) => group.lines.map((line) => line.rowNumber)),
  ).toEqual([[1, 3], [2]]);
  expect(groupInvoiceLinesByWarehouse({ ...invoice, lines: [] })).toEqual([]);
});
