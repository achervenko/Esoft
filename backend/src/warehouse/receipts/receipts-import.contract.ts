import { stockQuantity } from '../stock/stock.validation';
import { record, text, invalid, documentDate } from './receipts.validation';
export function receiptSourceVersion(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  )
    invalid('Версия должна быть положительной целочисленной строкой bigint.');
  return value;
}

// Source display values are snapshots: retain whitespace and spelling as received.
function snapshot(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max)
    invalid('Некорректный снимок исходных данных.');
  return value;
}

export function parseSourceReceipt(value: unknown, versionOverride?: string) {
  const b = record(value, [
    'id',
    'number',
    'date',
    'version',
    'status',
    'warehouse',
    'lines',
  ]);
  const warehouse = record(b.warehouse, ['id', 'name']);
  if (b.status !== 'POSTED' && b.status !== 'CANCELLED')
    invalid('Некорректный статус источника.');
  if (
    !Array.isArray(b.lines) ||
    b.lines.length > 100 ||
    (b.status === 'POSTED' && !b.lines.length)
  )
    invalid('Ожидается от 1 до 100 строк действующего документа.');
  const date = documentDate(b.date);
  if (!date) invalid('Укажите дату документа.');
  const lines = b.lines.map((value, index) => {
    const l = record(value, ['id', 'item', 'quantity', 'order']);
    const item = record(l.item, ['id', 'article', 'name', 'unit', 'type']);
    const order =
      l.order == null ? null : record(l.order, ['id', 'number', 'name']);
    const type = text(item.type, 30);
    return {
      id: text(l.id),
      rowNumber: index + 1,
      item: {
        id: text(item.id),
        article: snapshot(item.article, 100),
        name: snapshot(item.name, 255),
        unit: snapshot(item.unit, 50),
        type,
      },
      quantity: stockQuantity(l.quantity).toString(),
      order: order
        ? {
            id: text(order.id),
            number: snapshot(order.number, 100),
            name: snapshot(order.name, 255),
          }
        : null,
    };
  });
  if (new Set(lines.map((l) => l.id)).size !== lines.length)
    invalid('Повторяются ID строк документа.');
  return {
    id: text(b.id),
    number: text(b.number, 100),
    date,
    version: receiptSourceVersion(versionOverride ?? b.version),
    status: b.status,
    warehouse: { id: text(warehouse.id), name: snapshot(warehouse.name, 255) },
    lines,
  };
}
export type SourceReceipt = ReturnType<typeof parseSourceReceipt>;
