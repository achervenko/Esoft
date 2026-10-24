import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseWarehouseId } from '../catalog/catalog.validation';
import { stockQuantity } from '../stock/stock.validation';
import { MATCHING_STATUSES, SHEET_STATUSES } from './issue-sheets.model';

function invalid(message: string): never {
  throw new BadRequestException({ code: 'INVALID_ISSUE_SHEET_INPUT', message });
}
export function sheetRecord(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !keys.includes(key)))
    invalid('Переданы неизвестные поля.');
  return body;
}
function text(value: unknown, max: number, nullable = false) {
  if (nullable && (value === null || value === '')) return null;
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max ||
    value.includes('\0')
  )
    invalid('Некорректное текстовое поле.');
  return value.trim();
}
function sha256(value: unknown) {
  const hash = text(value, 64)!;
  if (!/^[a-fA-F0-9]{64}$/.test(hash))
    invalid('sourceFileHash должен содержать SHA-256.');
  return hash.toLowerCase();
}
function integer(value: unknown, fallback?: number, max = 2147483647) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^[1-9]\d{0,9}$/.test(String(value))
  )
    invalid('Ожидается положительное целое число.');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > max)
    invalid('Число вне допустимого диапазона.');
  return result;
}
function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback?: T,
): T {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !values.includes(value as T))
    invalid('Недопустимое значение фильтра или статуса.');
  return value as T;
}
function enumList<T extends string>(value: unknown, values: readonly T[]) {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  if (!list.length || list.length > values.length)
    invalid('Некорректный список статусов.');
  return [...new Set(list.map((v) => enumValue(v, values)))];
}
function boolean(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  invalid('Ожидается true или false.');
}
function date(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    invalid('Некорректная дата.');
  const result = new Date(value);
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(result.getTime()) ||
    !Number.isFinite(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    invalid('Некорректная дата.');
  return result;
}
export function parseCreateSheet(value: unknown) {
  const body = sheetRecord(value, ['name', 'sourceFileName', 'sourceFileHash']);
  const name = text(body.name, 255)!;
  const sourceFileName =
    body.sourceFileName === undefined
      ? null
      : text(body.sourceFileName, 255, true);
  const hash =
    body.sourceFileHash === undefined
      ? null
      : text(body.sourceFileHash, 64, true);
  return {
    name,
    sourceFileName,
    sourceFileHash: hash === null ? null : sha256(hash),
  };
}
const businessFields = [
  'itemId',
  'storageLocationId',
  'projectId',
  'quantity',
  'unitSnapshot',
  'matchingStatus',
  'error',
] as const;
const sourceLimits = {
  sourceArticle: 100,
  sourceName: 255,
  sourceLocation: 255,
  sourceProject: 255,
};
export type SheetLineInput = {
  itemId?: bigint | null;
  storageLocationId?: bigint | null;
  projectId?: bigint | null;
  quantity?: Prisma.Decimal;
  unitSnapshot?: string | null;
  matchingStatus?: string;
  error?: string | null;
  sourceArticle?: string | null;
  sourceName?: string | null;
  sourceLocation?: string | null;
  sourceProject?: string | null;
  rowNumber?: number;
};
export function parseSheetLine(value: unknown, create: boolean) {
  const body = sheetRecord(
    value,
    create
      ? [...businessFields, ...Object.keys(sourceLimits), 'rowNumber']
      : businessFields,
  );
  if (!Object.keys(body).length) invalid('Укажите поля строки.');
  const data: SheetLineInput = {};
  for (const key of ['itemId', 'storageLocationId', 'projectId'] as const) {
    if (key in body)
      data[key] = body[key] === null ? null : parseWarehouseId(body[key]);
  }
  if (create || 'quantity' in body)
    data.quantity = stockQuantity(body.quantity);
  if (create || 'matchingStatus' in body)
    data.matchingStatus = enumValue(
      body.matchingStatus,
      MATCHING_STATUSES,
      create ? 'UNMATCHED' : undefined,
    );
  for (const [key, max] of Object.entries({
    unitSnapshot: 50,
    error: 4000,
    ...(create ? sourceLimits : {}),
  })) {
    if (key in body)
      data[key as keyof typeof sourceLimits | 'unitSnapshot' | 'error'] = text(
        body[key],
        max,
        true,
      );
  }
  if (create) data.rowNumber = integer(body.rowNumber);
  return data;
}
export function parseSheetFilters(value: unknown) {
  const q = sheetRecord(value ?? {}, [
    'statuses',
    'createdByUserId',
    'processedByUserId',
    'projectId',
    'itemId',
    'hasErrors',
    'hasUnmatchedLines',
    'hasShortage',
    'sourceFileHash',
    'createdFrom',
    'createdTo',
    'processedFrom',
    'processedTo',
    'search',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ]);
  const result = {
    statuses:
      q.statuses === undefined
        ? undefined
        : enumList(q.statuses, SHEET_STATUSES),
    createdByUserId:
      q.createdByUserId === undefined
        ? undefined
        : text(q.createdByUserId, 255)!,
    processedByUserId:
      q.processedByUserId === undefined
        ? undefined
        : text(q.processedByUserId, 255)!,
    projectId:
      q.projectId === undefined ? undefined : parseWarehouseId(q.projectId),
    itemId: q.itemId === undefined ? undefined : parseWarehouseId(q.itemId),
    hasErrors: q.hasErrors === undefined ? undefined : boolean(q.hasErrors),
    hasUnmatchedLines:
      q.hasUnmatchedLines === undefined
        ? undefined
        : boolean(q.hasUnmatchedLines),
    hasShortage:
      q.hasShortage === undefined ? undefined : boolean(q.hasShortage),
    sourceFileHash:
      q.sourceFileHash === undefined ? undefined : sha256(q.sourceFileHash),
    createdFrom: q.createdFrom === undefined ? undefined : date(q.createdFrom),
    createdTo: q.createdTo === undefined ? undefined : date(q.createdTo),
    processedFrom:
      q.processedFrom === undefined ? undefined : date(q.processedFrom),
    processedTo: q.processedTo === undefined ? undefined : date(q.processedTo),
    search:
      q.search === undefined
        ? undefined
        : (text(q.search, 255, true) ?? undefined),
    sortBy: enumValue(
      q.sortBy,
      ['createdAt', 'processedAt', 'name', 'status'],
      'createdAt',
    ),
    sortOrder: enumValue(q.sortOrder, ['asc', 'desc'], 'desc'),
    page: integer(q.page, 1, 1000000),
    limit: integer(q.limit, 50, 100),
  };
  for (const [from, to] of [
    [result.createdFrom, result.createdTo],
    [result.processedFrom, result.processedTo],
  ])
    if (from && to && from > to) invalid('Начало диапазона позже окончания.');
  return result;
}
export function parseLineFilters(value: unknown) {
  const q = sheetRecord(value ?? {}, [
    'matchingStatuses',
    'itemId',
    'projectId',
    'storageLocationId',
    'hasError',
    'executionState',
    'rowFrom',
    'rowTo',
    'sortBy',
    'sortOrder',
    'page',
    'limit',
  ]);
  const result = {
    matchingStatuses:
      q.matchingStatuses === undefined
        ? undefined
        : enumList(q.matchingStatuses, MATCHING_STATUSES),
    itemId: q.itemId === undefined ? undefined : parseWarehouseId(q.itemId),
    projectId:
      q.projectId === undefined ? undefined : parseWarehouseId(q.projectId),
    storageLocationId:
      q.storageLocationId === undefined
        ? undefined
        : parseWarehouseId(q.storageLocationId),
    hasError: q.hasError === undefined ? undefined : boolean(q.hasError),
    executionState: enumValue(
      q.executionState,
      ['NOT_STARTED', 'PARTIAL', 'COMPLETED', 'ALL'],
      'ALL',
    ),
    rowFrom: q.rowFrom === undefined ? undefined : integer(q.rowFrom),
    rowTo: q.rowTo === undefined ? undefined : integer(q.rowTo),
    sortBy: enumValue(q.sortBy, ['rowNumber', 'quantity'], 'rowNumber'),
    sortOrder: enumValue(q.sortOrder, ['asc', 'desc'], 'asc'),
    page: integer(q.page, 1, 1000000),
    limit: integer(q.limit, 50, 100),
  };
  if (result.rowFrom && result.rowTo && result.rowFrom > result.rowTo)
    invalid('Начало диапазона позже окончания.');
  return result;
}
