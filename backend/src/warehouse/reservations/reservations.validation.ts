import { BadRequestException } from '@nestjs/common';
import { stockId, stockQuantity } from '../stock/stock.validation';
export function reservationRecord(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException({
      code: 'INVALID_WAREHOUSE_RESERVATION',
      message: 'Ожидается объект.',
    });
  const b = value as Record<string, unknown>;
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new BadRequestException({
      code: 'INVALID_WAREHOUSE_RESERVATION',
      message: 'Неизвестные поля.',
    });
  return b;
}
export function parseReservation(value: unknown, create = false) {
  const b = reservationRecord(
    value,
    create ? ['balanceId', 'projectId', 'quantity'] : ['quantity'],
  );
  return {
    quantity: stockQuantity(b.quantity),
    ...(create
      ? {
          balanceId: stockId(b.balanceId, 'balanceId'),
          projectId: stockId(b.projectId, 'projectId'),
        }
      : {}),
  };
}
export function parseReservationQuery(value: unknown) {
  const b = reservationRecord(value ?? {}, [
    'warehouseId',
    'balanceId',
    'projectId',
    'itemId',
    'locationId',
    'page',
    'limit',
  ]);
  const ids: {
    warehouseId?: bigint;
    balanceId?: bigint;
    projectId?: bigint;
    itemId?: bigint;
    locationId?: bigint;
  } = {};
  for (const k of [
    'warehouseId',
    'balanceId',
    'projectId',
    'itemId',
    'locationId',
  ] as const)
    if (b[k] !== undefined) ids[k] = stockId(b[k], k);
  function integer(k: string, fallback: number, max: number) {
    const v = b[k];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^[1-9]\d{0,9}$/.test(v) || Number(v) > max)
      throw new BadRequestException({
        code: 'INVALID_WAREHOUSE_RESERVATION',
        message: 'Некорректная пагинация.',
      });
    return Number(v);
  }
  const page = integer('page', 1, 2147483647),
    limit = integer('limit', 50, 100);
  if ((page - 1) * limit > 2147483647)
    throw new BadRequestException({
      code: 'INVALID_WAREHOUSE_RESERVATION',
      message: 'Слишком большая страница.',
    });
  return { ...ids, page, limit };
}
