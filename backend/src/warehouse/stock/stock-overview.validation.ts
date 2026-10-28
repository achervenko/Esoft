import { stockError } from './stock.errors';
import { stockId } from './stock.validation';
export function parseStockOverview(value: unknown = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Ожидается объект фильтров.',
    );
  const q = value as Record<string, unknown>;
  const allowed = [
    'search',
    'warehouseId',
    'locationId',
    'quantityState',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ];
  if (Object.keys(q).some((key) => !allowed.includes(key)))
    stockError(400, 'WAREHOUSE_STOCK_FILTER_INVALID', 'Неизвестный фильтр.');
  if (
    q.search !== undefined &&
    (typeof q.search !== 'string' ||
      q.search.length > 255 ||
      q.search.includes('\0'))
  )
    stockError(400, 'WAREHOUSE_STOCK_FILTER_INVALID', 'Некорректный поиск.');
  function choice<T extends string>(
    key: string,
    values: readonly T[],
    fallback: T,
  ): T {
    const v = q[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !values.includes(v as T))
      stockError(400, 'WAREHOUSE_STOCK_FILTER_INVALID', 'Некорректный фильтр.');
    return v as T;
  }
  function integer(key: string, fallback: number, max: number) {
    const v = q[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^[1-9]\d{0,9}$/.test(v) || Number(v) > max)
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Некорректная страница.',
      );
    return Number(v);
  }
  const page = integer('page', 1, 2147483647),
    limit = integer('limit', 50, 100);
  const offset = (page - 1) * limit;
  if (offset > 2147483647)
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Слишком большая страница.',
    );
  return {
    search: typeof q.search === 'string' ? q.search.trim() : '',
    warehouseId:
      q.warehouseId === undefined
        ? undefined
        : stockId(q.warehouseId, 'warehouseId'),
    locationId:
      q.locationId === undefined
        ? undefined
        : stockId(q.locationId, 'locationId'),
    quantityState: choice(
      'quantityState',
      ['POSITIVE', 'ZERO', 'ALL'] as const,
      'POSITIVE',
    ),
    sortBy: choice(
      'sortBy',
      ['article', 'name', 'quantity', 'warehouse'] as const,
      'article',
    ),
    sortOrder: choice('sortOrder', ['asc', 'desc'] as const, 'asc'),
    page,
    limit,
    offset,
  };
}
