import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { stockId, stockQuantity } from '../stock/stock.validation';
function invalid(message: string): never {
  throw new BadRequestException({
    code: 'WAREHOUSE_TRANSFER_INVALID',
    message,
  });
}
function record(value: unknown, fields: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !fields.includes(key)))
    invalid('Переданы неизвестные поля.');
  return body;
}
export function parseTransfer(value: unknown) {
  const body = record(value, [
    'requestKey',
    'itemId',
    'fromLocationId',
    'toLocationId',
    'quantity',
    'comment',
  ]);
  if (
    typeof body.requestKey !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.requestKey,
    )
  )
    invalid('requestKey должен быть UUID.');
  const itemId = String(stockId(body.itemId, 'itemId'));
  const fromLocationId = String(stockId(body.fromLocationId, 'fromLocationId'));
  const toLocationId = String(stockId(body.toLocationId, 'toLocationId'));
  if (fromLocationId === toLocationId)
    invalid('Исходное и целевое места должны различаться.');
  if (
    body.comment != null &&
    (typeof body.comment !== 'string' ||
      body.comment.includes('\0') ||
      body.comment.trim().length > 4000)
  )
    invalid('Некорректный комментарий.');
  return {
    requestKey: body.requestKey.toLowerCase(),
    itemId,
    fromLocationId,
    toLocationId,
    quantity: stockQuantity(body.quantity).toString(),
    comment:
      typeof body.comment === 'string' ? body.comment.trim() || null : null,
  };
}
export function transferHash(input: ReturnType<typeof parseTransfer>) {
  const { itemId, fromLocationId, toLocationId, quantity, comment } = input;
  const command = { itemId, fromLocationId, toLocationId, quantity, comment };
  return createHash('sha256').update(JSON.stringify(command)).digest('hex');
}
export function parseTransferQuery(value: unknown) {
  const q = record(value ?? {}, [
    'warehouseId',
    'itemId',
    'fromLocationId',
    'toLocationId',
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
  const page = positive('page', 1, 2147483647),
    limit = positive('limit', 50, 100);
  if ((page - 1) * limit > 2147483647) invalid('Слишком большое смещение.');
  return {
    warehouseId: id('warehouseId'),
    itemId: id('itemId'),
    fromLocationId: id('fromLocationId'),
    toLocationId: id('toLocationId'),
    page,
    limit,
  };
}
