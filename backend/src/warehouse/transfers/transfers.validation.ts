import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
    'distribution',
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
  const quantity = stockQuantity(body.quantity).toString();
  let distribution:
    | {
        freeQuantity: string;
        reservations: { reservationId: string; quantity: string }[];
      }
    | undefined;
  if (body.distribution !== undefined) {
    const split = record(body.distribution, ['freeQuantity', 'reservations']);
    if (!Array.isArray(split.reservations) || split.reservations.length > 1000)
      invalid('Некорректный список резервов.');
    const seen = new Set<string>();
    const reservations = split.reservations
      .map((value) => {
        const row = record(value, ['reservationId', 'quantity']);
        if (
          typeof row.reservationId !== 'string' ||
          !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
            row.reservationId,
          )
        )
          invalid('Некорректный ID резерва.');
        const reservationId = row.reservationId.toLowerCase();
        if (seen.has(reservationId)) invalid('Резерв указан повторно.');
        seen.add(reservationId);
        return {
          reservationId,
          quantity: stockQuantity(row.quantity).toString(),
        };
      })
      .sort((a, b) => a.reservationId.localeCompare(b.reservationId));
    const freeQuantity = stockQuantity(split.freeQuantity, true).toString();
    const sum = reservations.reduce(
      (sum, r) => sum.plus(r.quantity),
      new Prisma.Decimal(freeQuantity),
    );
    if (!sum.eq(quantity))
      invalid(
        'Сумма свободного количества и резервов должна совпадать с количеством перемещения.',
      );
    distribution = { freeQuantity, reservations };
  }
  return {
    ...(distribution ? { distribution } : {}),
    requestKey: body.requestKey.toLowerCase(),
    itemId,
    fromLocationId,
    toLocationId,
    quantity,
    comment:
      typeof body.comment === 'string' ? body.comment.trim() || null : null,
  };
}
export function transferHash(input: ReturnType<typeof parseTransfer>) {
  const { itemId, fromLocationId, toLocationId, quantity, comment } = input;
  const command = {
    itemId,
    fromLocationId,
    toLocationId,
    quantity,
    comment,
    ...(input.distribution ? { distribution: input.distribution } : {}),
  };
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
