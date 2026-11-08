import { stockError } from '../stock/stock.errors';
import { stockId, stockQuantity } from '../stock/stock.validation';
import { reservationUuid } from './reservation-common';

function invalid(message: string): never {
  stockError(400, 'WAREHOUSE_RESERVATION_INVALID', message);
}

function fields(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    invalid('Неизвестное поле запроса.');
  return input;
}

export function parseReservationUuid(value: unknown, field: string) {
  if (typeof value !== 'string' || !reservationUuid.test(value))
    invalid(`Некорректный идентификатор: ${field}.`);
  return value.toLowerCase();
}

function comment(value: unknown, required: boolean) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.includes('\0') || value.length > 4000)
    invalid('Ожидается комментарий длиной до 4000 символов.');
  const trimmed = value.trim();
  if (!trimmed && required) invalid('Укажите основание операции.');
  return trimmed || undefined;
}

function quantity(value: unknown, allowZero = false) {
  if (typeof value !== 'string') invalid('Количество должно быть строкой.');
  return stockQuantity(value, allowZero);
}

function placement(input: Record<string, unknown>) {
  return {
    locationId: stockId(input.locationId, 'locationId').toString(),
    quantity: quantity(input.quantity),
  };
}

export function parseReserve(value: unknown) {
  const input = fields(value, [
    'orderId',
    'itemId',
    'locationId',
    'quantity',
    'comment',
  ]);
  return {
    orderId: parseReservationUuid(input.orderId, 'orderId'),
    itemId: stockId(input.itemId, 'itemId').toString(),
    ...placement(input),
    comment: comment(input.comment, false),
  };
}

export function parseDecrease(value: unknown) {
  const input = fields(value, ['allocations', 'deficitQuantity', 'comment']);
  if (!Array.isArray(input.allocations) || input.allocations.length > 1000)
    invalid('Ожидается список из 0–1000 размещений.');
  return {
    allocations: input.allocations.map((row: unknown) =>
      placement(fields(row, ['locationId', 'quantity'])),
    ),
    deficitQuantity: quantity(input.deficitQuantity, true),
    comment: comment(input.comment, true),
  };
}

export function parseCoverage(value: unknown) {
  const input = fields(value, ['locationId', 'quantity', 'comment']);
  return { ...placement(input), comment: comment(input.comment, true) };
}

function pagination(input: Record<string, unknown>) {
  const integer = (key: string, fallback: number) => {
    const value = input[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value))
      invalid('Некорректная пагинация.');
    return Number(value);
  };
  const page = integer('page', 1);
  const limit = integer('limit', 50);
  const skip = (page - 1) * limit;
  if (limit > 100 || skip > 2147483647) invalid('Некорректная пагинация.');
  return { page, limit, skip };
}

export function parseReservationHistory(value: unknown) {
  return pagination(fields(value, ['page', 'limit']));
}

export function parseReservationList(value: unknown) {
  const input = fields(value, [
    'orderId',
    'itemId',
    'deficit',
    'covered',
    'quantityState',
    'page',
    'limit',
  ]);
  const flag = (key: string) => {
    const value = input[key];
    if (value === undefined) return undefined;
    if (value !== 'true' && value !== 'false')
      invalid('Ожидается true или false.');
    return value === 'true';
  };
  const quantityState = input.quantityState ?? 'POSITIVE';
  if (
    quantityState !== 'POSITIVE' &&
    quantityState !== 'ZERO' &&
    quantityState !== 'ALL'
  )
    invalid('Некорректный фильтр количества.');
  return {
    ...pagination(input),
    orderId:
      input.orderId === undefined
        ? undefined
        : parseReservationUuid(input.orderId, 'orderId'),
    itemId:
      input.itemId === undefined ? undefined : stockId(input.itemId, 'itemId'),
    deficit: flag('deficit'),
    covered: flag('covered'),
    quantityState,
  };
}
