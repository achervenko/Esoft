import { BadRequestException } from '@nestjs/common';
export function parseProjectsQuery(value: unknown) {
  const invalid = (): never => {
    throw new BadRequestException({
      code: 'INVALID_WAREHOUSE_PROJECT_QUERY',
      message: 'Некорректные параметры списка проектов.',
    });
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const q = value as Record<string, unknown>;
  if (
    Object.keys(q).some(
      (k) => !['search', 'isActive', 'page', 'limit'].includes(k),
    )
  )
    invalid();
  if (
    q.search !== undefined &&
    (typeof q.search !== 'string' ||
      q.search.length > 255 ||
      q.search.includes('\0'))
  )
    invalid();
  if (
    q.isActive !== undefined &&
    q.isActive !== 'true' &&
    q.isActive !== 'false'
  )
    invalid();
  function integer(key: string, fallback: number, max: number) {
    const v = q[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^[1-9]\d{0,9}$/.test(v) || Number(v) > max)
      invalid();
    return Number(v);
  }
  const page = integer('page', 1, 2147483647),
    limit = integer('limit', 50, 100);
  if ((page - 1) * limit > 2147483647) invalid();
  return {
    search: typeof q.search === 'string' ? q.search.trim() : undefined,
    isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
    page,
    limit,
  };
}
