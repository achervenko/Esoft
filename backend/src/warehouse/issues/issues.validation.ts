import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { parseWarehouseId } from '../catalog/catalog.validation';
import { stockQuantity } from '../stock/stock.validation';

export function issueInvalid(message: string): never {
  throw new BadRequestException({ code: 'INVALID_WAREHOUSE_ISSUE', message });
}
export function issueRecord(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    issueInvalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !keys.includes(key)))
    issueInvalid('Переданы неизвестные поля.');
  return body;
}
function bool(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  issueInvalid('Ожидается true или false.');
}
function text(value: unknown, max: number) {
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    value.trim().length > max
  )
    issueInvalid('Некорректное текстовое поле.');
  return value.trim();
}
export function parseIssue(value: unknown, preview = false) {
  const b = issueRecord(value, [
    'requestKey',
    'type',
    'projectId',
    'issueSheetLineId',
    'positions',
    'comment',
    'overrideReservations',
    'overrideConfirmation',
  ]);
  let requestKey: string | null = null;
  if (!preview || b.requestKey !== undefined) {
    if (
      typeof b.requestKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        b.requestKey,
      )
    )
      issueInvalid('requestKey должен быть UUID.');
    requestKey = b.requestKey.toLowerCase();
  }
  if (b.type !== 'MANUAL' && b.type !== 'ISSUE_SHEET')
    issueInvalid('Укажите тип MANUAL или ISSUE_SHEET.');
  const projectId =
    b.projectId === undefined
      ? undefined
      : b.projectId === null
        ? null
        : parseWarehouseId(b.projectId);
  const issueSheetLineId =
    b.issueSheetLineId === undefined || b.issueSheetLineId === null
      ? null
      : parseWarehouseId(b.issueSheetLineId);
  if (
    (b.type === 'MANUAL' && issueSheetLineId !== null) ||
    (b.type === 'ISSUE_SHEET' && issueSheetLineId === null)
  )
    issueInvalid('Связь с листом не соответствует типу выдачи.');
  if (
    !Array.isArray(b.positions) ||
    !b.positions.length ||
    b.positions.length > 100
  )
    issueInvalid('Укажите от 1 до 100 позиций выдачи.');
  const positions = b.positions.map((value) => {
    const row = issueRecord(value, ['balanceId', 'quantity']);
    return {
      balanceId: parseWarehouseId(row.balanceId),
      quantity: stockQuantity(row.quantity),
    };
  });
  if (
    new Set(positions.map((p) => String(p.balanceId))).size !== positions.length
  )
    issueInvalid('Остаток не должен повторяться в выдаче.');
  positions.sort((a, b) => (a.balanceId < b.balanceId ? -1 : 1));
  const overrideReservations =
    b.overrideReservations === undefined ? false : bool(b.overrideReservations);
  const comment =
    b.comment === undefined || b.comment === null
      ? null
      : text(b.comment, 4000) || null;
  if (overrideReservations && !comment)
    issueInvalid('Для принудительной выдачи укажите основание в comment.');
  const overrideConfirmation =
    b.overrideConfirmation === undefined
      ? undefined
      : text(b.overrideConfirmation, 64);
  if (
    overrideConfirmation !== undefined &&
    (!overrideReservations || !/^[a-f0-9]{64}$/.test(overrideConfirmation))
  )
    issueInvalid('Некорректное подтверждение принудительной выдачи.');
  return {
    requestKey,
    type: b.type,
    projectId,
    issueSheetLineId,
    positions,
    comment,
    overrideReservations,
    overrideConfirmation,
  };
}
export type IssueInput = ReturnType<typeof parseIssue>;
export function parseAvailableQuery(value: unknown) {
  const b = issueRecord(value ?? {}, [
    'warehouseId',
    'itemId',
    'projectId',
    'includeUnavailable',
  ]);
  return {
    warehouseId:
      b.warehouseId === undefined ? undefined : parseWarehouseId(b.warehouseId),
    itemId: parseWarehouseId(b.itemId),
    projectId: b.projectId === undefined ? null : parseWarehouseId(b.projectId),
    includeUnavailable:
      b.includeUnavailable === undefined ? false : bool(b.includeUnavailable),
  };
}
function ids(single: unknown, multiple: unknown) {
  if (single !== undefined && multiple !== undefined)
    issueInvalid(
      'Используйте одиночный фильтр или список, не оба одновременно.',
    );
  if (single !== undefined) return [parseWarehouseId(single)];
  if (multiple === undefined) return undefined;
  const list = typeof multiple === 'string' ? multiple.split(',') : multiple;
  if (!Array.isArray(list) || !list.length || list.length > 100)
    issueInvalid('Некорректный список идентификаторов.');
  return [...new Set(list.map(parseWarehouseId))];
}
function positive(value: unknown, fallback: number, max: number) {
  if (value === undefined) return fallback;
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^[1-9]\d{0,9}$/.test(String(value)) ||
    Number(value) > max
  )
    issueInvalid('Некорректная пагинация.');
  return Number(value);
}
function date(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    issueInvalid('Некорректная дата.');
  const calendar = new Date(value.slice(0, 10) + 'T00:00:00Z');
  const result = new Date(value);
  if (
    !Number.isFinite(result.getTime()) ||
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    issueInvalid('Некорректная дата.');
  return result;
}
export function parseIssueFilters(value: unknown) {
  const q = issueRecord(value ?? {}, [
    'warehouseId',
    'search',
    'types',
    'itemId',
    'itemIds',
    'projectId',
    'projectIds',
    'balanceId',
    'locationId',
    'issueSheetId',
    'issueSheetLineId',
    'issuedByUserId',
    'overrideReservations',
    'createdFrom',
    'createdTo',
    'minQuantity',
    'maxQuantity',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ]);
  const types =
    q.types === undefined
      ? undefined
      : typeof q.types === 'string'
        ? q.types.split(',')
        : q.types;
  if (
    types !== undefined &&
    (!Array.isArray(types) ||
      !types.length ||
      types.some((t) => t !== 'MANUAL' && t !== 'ISSUE_SHEET'))
  )
    issueInvalid('Некорректные типы выдачи.');
  const sortBy = q.sortBy ?? 'createdAt',
    sortOrder = q.sortOrder ?? 'desc';
  if (sortBy !== 'createdAt' && sortBy !== 'quantity')
    issueInvalid('Некорректная сортировка.');
  if (sortOrder !== 'asc' && sortOrder !== 'desc')
    issueInvalid('Некорректный порядок сортировки.');
  const filters = {
    search:
      q.search === undefined ? undefined : text(q.search, 255) || undefined,
    warehouseId:
      q.warehouseId === undefined ? undefined : parseWarehouseId(q.warehouseId),
    types: types as string[] | undefined,
    itemIds: ids(q.itemId, q.itemIds),
    projectIds: ids(q.projectId, q.projectIds),
    balanceId:
      q.balanceId === undefined ? undefined : parseWarehouseId(q.balanceId),
    locationId:
      q.locationId === undefined ? undefined : parseWarehouseId(q.locationId),
    issueSheetId:
      q.issueSheetId === undefined
        ? undefined
        : parseWarehouseId(q.issueSheetId),
    issueSheetLineId:
      q.issueSheetLineId === undefined
        ? undefined
        : parseWarehouseId(q.issueSheetLineId),
    issuedByUserId:
      q.issuedByUserId === undefined ? undefined : text(q.issuedByUserId, 255),
    overrideReservations:
      q.overrideReservations === undefined
        ? undefined
        : bool(q.overrideReservations),
    createdFrom: date(q.createdFrom),
    createdTo: date(q.createdTo),
    minQuantity:
      q.minQuantity === undefined
        ? undefined
        : stockQuantity(q.minQuantity, true),
    maxQuantity:
      q.maxQuantity === undefined
        ? undefined
        : stockQuantity(q.maxQuantity, true),
    sortBy,
    sortOrder,
    page: positive(q.page, 1, 1000000),
    limit: positive(q.limit, 50, 100),
  };
  if (
    (filters.createdFrom &&
      filters.createdTo &&
      filters.createdFrom > filters.createdTo) ||
    (filters.minQuantity &&
      filters.maxQuantity &&
      filters.minQuantity.gt(filters.maxQuantity))
  )
    issueInvalid('Начало диапазона больше окончания.');
  return filters;
}

export function issueRequestHash(input: IssueInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        type: input.type,
        projectId:
          input.projectId === undefined && input.type === 'ISSUE_SHEET'
            ? 'UNSPECIFIED'
            : (input.projectId?.toString() ?? null),
        issueSheetLineId: input.issueSheetLineId?.toString() ?? null,
        positions: input.positions.map((p) => ({
          balanceId: String(p.balanceId),
          quantity: p.quantity.toString(),
        })),
        comment: input.comment,
        overrideReservations: input.overrideReservations,
      }),
    )
    .digest('hex');
}
