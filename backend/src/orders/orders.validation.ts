import { BadRequestException } from '@nestjs/common';
export function orderId(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('Некорректный идентификатор.');
  return value.toLowerCase();
}
export function ordersQuery(value: unknown) {
  const fail = (): never => {
    throw new BadRequestException('Некорректные параметры поиска заказов.');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const q = value as Record<string, unknown>;
  if (
    Object.keys(q).some(
      (k) =>
        ![
          'search',
          'closed',
          'statuses',
          'deleted',
          'missing',
          'sourceId',
          'page',
          'limit',
        ].includes(k),
    )
  )
    fail();
  const integer = (v: unknown, fallback: number, max: number) => {
    if (v === undefined) return fallback;
    if (typeof v !== 'string' || !/^[1-9]\d*$/.test(v) || Number(v) > max)
      fail();
    return Number(v);
  };
  if (
    q.search !== undefined &&
    (typeof q.search !== 'string' ||
      q.search.length > 255 ||
      q.search.includes('\0'))
  )
    fail();
  if (q.closed !== undefined && q.closed !== 'true' && q.closed !== 'false')
    fail();
  if (q.missing !== undefined && q.missing !== 'true' && q.missing !== 'false')
    fail();
  if (
    q.deleted !== undefined &&
    q.deleted !== 'true' &&
    q.deleted !== 'false' &&
    q.deleted !== 'all'
  )
    fail();
  let statuses: string[] | undefined;
  if (q.statuses !== undefined) {
    if (typeof q.statuses !== 'string' || q.statuses.length > 12000) fail();
    let parsed: unknown;
    try {
      parsed = JSON.parse(q.statuses as string);
    } catch {
      fail();
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length > 100 ||
      parsed.some(
        (v) =>
          typeof v !== 'string' ||
          !v.trim() ||
          v.length > 100 ||
          v.includes('\0'),
      )
    )
      fail();
    statuses = [...new Set(parsed as string[])];
    if (statuses.length && q.closed !== undefined) fail();
  }
  return {
    statuses,
    deleted: q.deleted as string | undefined,
    missing: q.missing as string | undefined,
    search: (q.search as string | undefined)?.trim(),
    closed: q.closed as string | undefined,
    sourceId:
      q.sourceId === undefined
        ? undefined
        : typeof q.sourceId === 'string'
          ? orderId(q.sourceId)
          : fail(),
    page: integer(q.page, 1, 100000),
    limit: integer(q.limit, 50, 100),
  };
}
