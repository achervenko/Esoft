import { BadRequestException } from '@nestjs/common';

export function locationBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export function storageRecord(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    locationBadRequest('INVALID_PAYLOAD', 'Ожидается объект.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !allowed.includes(key)))
    locationBadRequest('UNKNOWN_FIELDS', 'Переданы неизвестные поля.');
  return result;
}

export function parseLocationId(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value))
    locationBadRequest('INVALID_WAREHOUSE_ID', 'Некорректный идентификатор.');
  const id = BigInt(value);
  if (id > 9223372036854775807n)
    locationBadRequest('INVALID_WAREHOUSE_ID', 'Некорректный идентификатор.');
  return id;
}

type LocationFields = { code: string; name: string; isActive: boolean };
export function parseStorageEntry(
  value: unknown,
  create = false,
): Partial<LocationFields> {
  const body = storageRecord(value, ['code', 'name', 'isActive']);
  if (!Object.keys(body).length)
    locationBadRequest('EMPTY_PAYLOAD', 'Укажите изменяемые поля.');
  const data: Partial<LocationFields> = {};
  for (const key of ['code', 'name'] as const) {
    if (!(key in body) && !create) continue;
    const v = body[key];
    if (
      typeof v !== 'string' ||
      !v.trim() ||
      v.trim().length > (key === 'code' ? 100 : 255) ||
      v.includes('\0')
    )
      locationBadRequest(
        'INVALID_STORAGE_LOCATION_FIELD',
        `Некорректное поле ${key}.`,
      );
    data[key] = v.trim();
  }
  if ('isActive' in body) {
    if (typeof body.isActive !== 'boolean')
      locationBadRequest(
        'INVALID_STORAGE_LOCATION_FIELD',
        'Некорректная активность.',
      );
    data.isActive = body.isActive;
  }
  return data;
}
export function parseLocationQuery(value: unknown) {
  const q = storageRecord(value ?? {}, [
    'search',
    'isActive',
    'page',
    'limit',
    'sortBy',
    'sortOrder',
  ]);
  let search: string | undefined;
  if (q.search !== undefined) {
    if (
      typeof q.search !== 'string' ||
      q.search.length > 255 ||
      q.search.includes('\0')
    )
      locationBadRequest('INVALID_QUERY', 'Некорректный поиск.');
    search = q.search.trim() || undefined;
  }
  if (
    q.isActive !== undefined &&
    q.isActive !== 'true' &&
    q.isActive !== 'false'
  )
    locationBadRequest('INVALID_QUERY', 'Некорректная активность.');
  const sortBy = q.sortBy ?? 'code';
  const sortOrder = q.sortOrder ?? 'asc';
  if (sortBy !== 'code' && sortBy !== 'name' && sortBy !== 'isActive')
    locationBadRequest('INVALID_QUERY', 'Некорректная сортировка.');
  if (sortOrder !== 'asc' && sortOrder !== 'desc')
    locationBadRequest('INVALID_QUERY', 'Некорректный порядок сортировки.');
  function integer(key: string, fallback: number, max: number) {
    const v = q[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^[1-9]\d{0,9}$/.test(v) || Number(v) > max)
      locationBadRequest('INVALID_QUERY', 'Некорректная страница.');
    return Number(v);
  }
  const page = integer('page', 1, 2147483647),
    limit = integer('limit', 50, 100);
  const offset = (page - 1) * limit;
  if (offset > 2147483647)
    locationBadRequest('INVALID_QUERY', 'Слишком большая страница.');
  return {
    search,
    isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
    page,
    limit,
    offset,
    sortBy,
    sortOrder,
  };
}

export function parseLocation(value: unknown, create = false) {
  const body = storageRecord(
    value,
    create
      ? ['code', 'name', 'isActive', 'warehouseId']
      : ['code', 'name', 'isActive'],
  );
  const { warehouseId, ...entry } = body;
  return {
    ...parseStorageEntry(entry, create),
    ...(create ? { warehouseId: parseLocationId(warehouseId) } : {}),
  };
}
export function parseStorageLocationQuery(value: unknown) {
  const body = storageRecord(value ?? {}, [
    'search',
    'isActive',
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'warehouseId',
  ]);
  const { warehouseId, ...query } = body;
  return {
    ...parseLocationQuery(query),
    warehouseId:
      warehouseId === undefined ? undefined : parseLocationId(warehouseId),
  };
}
