import { stockError } from './stock.errors';
import { parseBalanceFilters } from './stock.validation';
import type { BalanceFilters } from './stock.types';

export function parseStockHttpQuery(value: unknown): BalanceFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    stockError(
      400,
      'WAREHOUSE_STOCK_FILTER_INVALID',
      'Ожидается объект фильтров.',
    );
  const filters: Record<string, unknown> = { ...value };
  for (const key of ['itemIds', 'locationIds']) {
    const v = filters[key];
    if (v === undefined) continue;
    if (typeof v === 'string') filters[key] = v.split(',');
    else if (!Array.isArray(v) || v.some((id) => typeof id !== 'string'))
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Некорректный список ID.',
      );
  }
  for (const key of ['itemActive', 'locationActive']) {
    if (filters[key] === undefined) continue;
    if (filters[key] !== 'true' && filters[key] !== 'false')
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Ожидается true или false.',
      );
    filters[key] = filters[key] === 'true';
  }
  for (const key of ['page', 'limit']) {
    const v = filters[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !/^[1-9]\d{0,9}$/.test(v))
      stockError(
        400,
        'WAREHOUSE_STOCK_FILTER_INVALID',
        'Некорректная пагинация.',
      );
    filters[key] = Number(v);
  }
  const result = filters as BalanceFilters;
  parseBalanceFilters(result);
  return result;
}
