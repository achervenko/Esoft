import { Prisma } from '@prisma/client';
import { stockError } from './stock.errors';
import type { BalanceFilters } from './stock.types';

export const MAX_STOCK_QUANTITY = new Prisma.Decimal('99999999999.999');

export function stockId(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value))
    stockError(
      400,
      'WAREHOUSE_STOCK_ID_INVALID',
      'Некорректный идентификатор.',
      { field },
    );
  const id = BigInt(value);
  if (id > 9223372036854775807n)
    stockError(
      400,
      'WAREHOUSE_STOCK_ID_INVALID',
      'Некорректный идентификатор.',
      { field },
    );
  return id;
}

export function stockQuantity(
  value: unknown,
  allowZero = false,
): Prisma.Decimal {
  if (
    !(value instanceof Prisma.Decimal) &&
    (typeof value !== 'string' ||
      !/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(value))
  )
    stockError(
      400,
      'WAREHOUSE_STOCK_QUANTITY_INVALID',
      'Количество должно быть десятичной строкой или Decimal с точностью до трёх знаков.',
    );
  const quantity = new Prisma.Decimal(value);
  if (
    !quantity.isFinite() ||
    quantity.decimalPlaces() > 3 ||
    (allowZero ? quantity.lt(0) : quantity.lte(0)) ||
    quantity.gt(MAX_STOCK_QUANTITY)
  )
    stockError(
      400,
      'WAREHOUSE_STOCK_QUANTITY_INVALID',
      'Количество вне допустимого диапазона.',
    );
  return quantity;
}

export function parseBalanceFilters(value: BalanceFilters = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Ожидается объект фильтров.',
    );
  const allowed = [
    'warehouseId',
    'itemId',
    'itemIds',
    'locationId',
    'locationIds',
    'quantityState',
    'minQuantity',
    'maxQuantity',
    'itemActive',
    'locationActive',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    stockError(400, 'WAREHOUSE_STOCK_FILTER_INVALID', 'Неизвестный фильтр.');
  function ids(
    single: 'itemId' | 'locationId',
    multiple: 'itemIds' | 'locationIds',
  ) {
    if (value[single] !== undefined && value[multiple] !== undefined)
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Одиночный и множественный фильтры нельзя совмещать.',
        { field: single },
      );
    if (value[single] !== undefined) return [stockId(value[single], single)];
    const entries = value[multiple];
    if (entries === undefined) return undefined;
    if (
      !Array.isArray(entries) ||
      entries.length === 0 ||
      entries.length > 1000
    )
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Список ID должен содержать от 1 до 1000 элементов.',
        { field: multiple },
      );
    return [...new Set(entries.map((id) => stockId(id, multiple)))];
  }
  for (const key of ['itemActive', 'locationActive'] as const)
    if (value[key] !== undefined && typeof value[key] !== 'boolean')
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Фильтр активности должен быть boolean.',
        { field: key },
      );
  function choice<T extends string>(
    entry: unknown,
    choices: readonly T[],
    fallback: T,
  ): T {
    if (entry === undefined) return fallback;
    if (typeof entry !== 'string' || !choices.includes(entry as T))
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Недопустимое значение фильтра.',
      );
    return entry as T;
  }
  const page = value.page === undefined ? 1 : value.page;
  const limit = value.limit === undefined ? 50 : value.limit;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (page - 1) * limit > 2147483647
  )
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Некорректная пагинация.',
    );
  const min =
    value.minQuantity === undefined
      ? undefined
      : stockQuantity(value.minQuantity, true);
  const max =
    value.maxQuantity === undefined
      ? undefined
      : stockQuantity(value.maxQuantity, true);
  if (min !== undefined && max !== undefined && min.gt(max))
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Минимальное количество превышает максимальное.',
    );
  return {
    warehouseId:
      value.warehouseId === undefined
        ? undefined
        : stockId(value.warehouseId, 'warehouseId'),
    itemIds: ids('itemId', 'itemIds'),
    locationIds: ids('locationId', 'locationIds'),
    quantityState: choice(
      value.quantityState,
      ['POSITIVE', 'ZERO', 'ALL'] as const,
      'POSITIVE',
    ),
    min,
    max,
    itemActive: value.itemActive,
    locationActive: value.locationActive,
    sortBy: choice(
      value.sortBy,
      ['quantity', 'item', 'location'] as const,
      'item',
    ),
    sortOrder: choice(value.sortOrder, ['asc', 'desc'] as const, 'asc'),
    page,
    limit,
  };
}
