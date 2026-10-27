import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { stockId, stockQuantity } from '../stock/stock.validation';

export function invalid(message: string): never {
  throw new BadRequestException({ code: 'WAREHOUSE_RECEIPT_INVALID', message });
}
function record(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !fields.includes(key)))
    invalid('Переданы неизвестные поля.');
  return body;
}
export function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    value.trim().length > max
  )
    invalid('Некорректное текстовое поле.');
  return value.trim() || null;
}
function documentDate(value: unknown) {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    invalid('Ожидается дата YYYY-MM-DD.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    invalid('Несуществующая дата.');
  return value;
}
export function parseReceipt(value: unknown) {
  const b = record(value, [
    'warehouseId',
    'documentNumber',
    'documentDate',
    'comment',
    'lines',
  ]);
  if (!Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 100)
    invalid('Укажите от 1 до 100 строк.');
  const lines = b.lines.map((value, index) => {
    const line = record(value, ['itemId', 'storageLocationId', 'quantity']);
    return {
      rowNumber: index + 1,
      itemId: String(stockId(line.itemId, 'itemId')),
      storageLocationId: String(
        stockId(line.storageLocationId, 'storageLocationId'),
      ),
      quantity: stockQuantity(line.quantity).toString(),
    };
  });
  if (
    new Set(lines.map((line) => `${line.itemId}:${line.storageLocationId}`))
      .size !== lines.length
  )
    invalid('Товар и место не должны повторяться.');
  return {
    warehouseId: String(stockId(b.warehouseId, 'warehouseId')),
    documentNumber: optionalText(b.documentNumber, 100),
    documentDate: documentDate(b.documentDate),
    comment: optionalText(b.comment, 4000),
    lines,
  };
}
export function parseManualReceipt(value: unknown) {
  const b = record(value, [
    'warehouseId',
    'requestKey',
    'documentNumber',
    'documentDate',
    'comment',
    'lines',
  ]);
  const { requestKey, ...body } = b;
  // Accept RFC UUID versions 1–8, with the RFC variant; normalize case.
  if (
    typeof requestKey !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestKey,
    )
  )
    invalid('requestKey должен быть UUID.');
  return { input: parseReceipt(body), requestKey: requestKey.toLowerCase() };
}
export type ReceiptInput = ReturnType<typeof parseReceipt>;
export function orderedLines(input: ReceiptInput) {
  return [...input.lines].sort((a, b) => {
    for (const key of ['itemId', 'storageLocationId'] as const) {
      if (BigInt(a[key]) !== BigInt(b[key]))
        return BigInt(a[key]) < BigInt(b[key]) ? -1 : 1;
    }
    return 0;
  });
}
export function receiptHash(input: ReceiptInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        lines: orderedLines(input).map(
          ({ itemId, storageLocationId, quantity }) => ({
            itemId,
            storageLocationId,
            quantity,
          }),
        ),
      }),
    )
    .digest('hex');
}

export function parseReceiptQuery(value: unknown) {
  const q = record(value ?? {}, [
    'warehouseId',
    'source',
    'itemId',
    'storageLocationId',
    'createdByUserId',
    'createdFrom',
    'createdTo',
    'search',
    'page',
    'limit',
  ]);
  const id = (key: string) =>
    q[key] === undefined ? undefined : stockId(q[key], key);
  const positive = (key: string, fallback: number, max: number) => {
    if (q[key] === undefined) return fallback;
    if (
      typeof q[key] !== 'string' ||
      !/^[1-9]\d{0,9}$/.test(q[key]) ||
      Number(q[key]) > max
    )
      invalid('Некорректная пагинация.');
    return Number(q[key]);
  };
  const timestamp = (key: string) => {
    if (q[key] === undefined) return undefined;
    const v = q[key];
    if (
      typeof v !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        v,
      ) ||
      !Number.isFinite(Date.parse(v))
    )
      invalid('Укажите ISO дату и время с часовым поясом.');
    documentDate(v.slice(0, 10));
    return new Date(v);
  };
  if (q.source !== undefined && q.source !== 'MANUAL' && q.source !== 'ONE_C')
    invalid('Некорректный источник.');
  const page = positive('page', 1, 2147483647),
    limit = positive('limit', 50, 100),
    offset = (page - 1) * limit;
  if (offset > 2147483647) invalid('Слишком большая страница.');
  const createdFrom = timestamp('createdFrom'),
    createdTo = timestamp('createdTo');
  if (createdFrom && createdTo && createdFrom > createdTo)
    invalid('Некорректный период.');
  const createdByUserId = optionalText(q.createdByUserId, 255);
  if (q.createdByUserId !== undefined && !createdByUserId)
    invalid('Укажите автора.');
  return {
    warehouseId: id('warehouseId'),
    itemId: id('itemId'),
    storageLocationId: id('storageLocationId'),
    source: q.source,
    createdByUserId: createdByUserId ?? undefined,
    createdFrom,
    createdTo,
    search: optionalText(q.search, 100),
    page,
    limit,
    offset,
  };
}
