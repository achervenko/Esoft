import { BadRequestException } from '@nestjs/common';

export function catalogBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

function record(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    catalogBadRequest('INVALID_PAYLOAD', 'Ожидается объект.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !allowed.includes(key)))
    catalogBadRequest('UNKNOWN_FIELDS', 'Переданы неизвестные поля.');
  return result;
}

export function parseWarehouseId(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value))
    catalogBadRequest('INVALID_WAREHOUSE_ID', 'Некорректный идентификатор.');
  const id = BigInt(value);
  if (id > 9223372036854775807n)
    catalogBadRequest('INVALID_WAREHOUSE_ID', 'Некорректный идентификатор.');
  return id;
}

type CatalogFields = {
  article: string;
  name: string;
  unit: string;
  comment: string | null;
};
const textLimits = { article: 100, name: 255, unit: 50 };

export function parseCatalogItem(
  value: unknown,
  create = false,
): Partial<CatalogFields> {
  const body = record(value, ['article', 'name', 'unit', 'comment']);
  if (!Object.keys(body).length)
    catalogBadRequest('EMPTY_PAYLOAD', 'Укажите изменяемые поля.');
  const data: Partial<CatalogFields> = {};
  for (const key of ['article', 'name', 'unit'] as const) {
    if (!(key in body) && !create) continue;
    const field = body[key];
    if (
      typeof field !== 'string' ||
      !field.trim() ||
      field.trim().length > textLimits[key] ||
      field.includes('\0')
    )
      catalogBadRequest('INVALID_CATALOG_FIELD', `Некорректное поле ${key}.`);
    data[key] = field.trim();
  }
  if ('comment' in body) {
    if (
      body.comment !== null &&
      (typeof body.comment !== 'string' || body.comment.includes('\0'))
    )
      catalogBadRequest('INVALID_CATALOG_FIELD', 'Некорректный комментарий.');
    data.comment =
      typeof body.comment === 'string' ? body.comment.trim() || null : null;
  } else if (create) data.comment = null;
  return data;
}

export function parseCatalogStatus(value: unknown) {
  const body = record(value, ['isActive']);
  if (typeof body.isActive !== 'boolean')
    catalogBadRequest(
      'INVALID_CATALOG_STATUS',
      'Укажите isActive: true или false.',
    );
  return { isActive: body.isActive };
}

export function parseCatalogQuery(value: unknown) {
  const query = record(value ?? {}, ['q', 'isActive', 'limit', 'offset']);
  let q: string | undefined;
  if (query.q !== undefined) {
    if (
      typeof query.q !== 'string' ||
      query.q.trim().length > 255 ||
      query.q.includes('\0')
    )
      catalogBadRequest('INVALID_CATALOG_QUERY', 'Некорректная строка поиска.');
    q = query.q.trim() || undefined;
  }
  let isActive: boolean | undefined;
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false')
      catalogBadRequest(
        'INVALID_CATALOG_QUERY',
        'Некорректный фильтр активности.',
      );
    isActive = query.isActive === 'true';
  }
  function integer(key: string, fallback: number, min: number, max: number) {
    if (query[key] === undefined) return fallback;
    const field = query[key];
    if (typeof field !== 'string' || !/^(0|[1-9]\d{0,9})$/.test(field))
      catalogBadRequest(
        'INVALID_CATALOG_QUERY',
        'Некорректные параметры страницы.',
      );
    const number = Number(field);
    if (number < min || number > max)
      catalogBadRequest(
        'INVALID_CATALOG_QUERY',
        'Некорректные параметры страницы.',
      );
    return number;
  }
  return {
    q,
    isActive,
    limit: integer('limit', 50, 1, 100),
    offset: integer('offset', 0, 0, 2147483647),
  };
}
