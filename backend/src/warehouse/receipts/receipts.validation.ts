import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { stockId, stockQuantity } from '../stock/stock.validation';
import { parseCatalogItem } from '../catalog/catalog.validation';
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'WAREHOUSE_RECEIPT_INVALID', message });
}
export function record(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !fields.includes(key)))
    invalid('Переданы неизвестные поля.');
  return body;
}
export function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.includes('\0') || value.length > max)
    invalid('Некорректное текстовое поле.');
  return value.trim() || null;
}
export function text(value: unknown, max = 255): string {
  const result = optionalText(value, max);
  if (!result) invalid('Обязательное текстовое поле не заполнено.');
  return result;
}
export function uuid(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid('Ожидается UUID.');
  return value.toLowerCase();
}
export function documentDate(value: unknown): string | null {
  if (value == null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    invalid('Ожидается дата YYYY-MM-DD.');
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    invalid('Несуществующая дата.');
  return value;
}
export function parseManualReceipt(value: unknown) {
  const b = record(value, [
    'warehouseId',
    'requestKey',
    'documentNumber',
    'documentDate',
    'comment',
    'lines',
    'newItems',
  ]);
  const newItems = b.newItems === undefined ? [] : b.newItems;
  if (!Array.isArray(newItems) || newItems.length > 100)
    invalid('Некорректные новые товары.');
  const drafts = newItems
    .map((value) => {
      const draft = record(value, ['draftId', 'item']);
      return {
        draftId: uuid(draft.draftId),
        item: parseCatalogItem(draft.item, true),
      };
    })
    .sort((a, b) => a.draftId.localeCompare(b.draftId));
  if (new Set(drafts.map((d) => d.draftId)).size !== drafts.length)
    invalid('Повторяются новые товары.');
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100)
    invalid('Укажите от 1 до 100 строк.');
  return {
    requestKey: uuid(b.requestKey),
    input: {
      ...(drafts.length ? { newItems: drafts } : {}),
      warehouseId: String(stockId(b.warehouseId, 'warehouseId')),
      documentNumber: optionalText(b.documentNumber, 100),
      documentDate: documentDate(b.documentDate),
      comment: optionalText(b.comment, 4000),
      lines: b.lines.map((value, index) => {
        const l = record(value, ['itemId', 'draftId', 'quantity', 'orderId']);
        if ((l.itemId === undefined) === (l.draftId === undefined))
          invalid('Укажите товар или черновик.');
        const draftId = l.draftId === undefined ? undefined : uuid(l.draftId);
        if (draftId && !drafts.some((d) => d.draftId === draftId))
          invalid('Новый товар не найден.');
        return {
          rowNumber: index + 1,
          itemId: draftId ? undefined : String(stockId(l.itemId, 'itemId')),
          ...(draftId ? { draftId } : {}),
          quantity: stockQuantity(l.quantity).toString(),
          ...(l.orderId === undefined ? {} : { orderId: uuid(l.orderId) }),
        };
      }),
    },
  };
}
export function receiptHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function parsePlacement(value: unknown) {
  const b = record(value, [
    'requestKey',
    'storageLocationId',
    'quantity',
    'reservationAllocation',
  ]);
  const allocation =
    b.reservationAllocation === undefined
      ? undefined
      : record(b.reservationAllocation, [
          'restoreQuantity',
          'increaseQuantity',
        ]);
  const amount = (value: unknown) => {
    if (typeof value !== 'string')
      invalid('Количество распределения должно быть строкой.');
    return stockQuantity(value, true).toString();
  };
  return {
    requestKey: uuid(b.requestKey),
    storageLocationId: String(
      stockId(b.storageLocationId, 'storageLocationId'),
    ),
    quantity: stockQuantity(b.quantity).toString(),
    ...(allocation
      ? {
          reservationAllocation: {
            restoreQuantity: amount(allocation.restoreQuantity),
            increaseQuantity: amount(allocation.increaseQuantity),
          },
        }
      : {}),
  };
}
export function parseReceiptQuery(value: unknown) {
  const q = record(value ?? {}, [
    'warehouseId',
    'source',
    'status',
    'attention',
    'hasProblems',
    'hasConflict',
    'sortBy',
    'sortOrder',
    'itemId',
    'createdByUserId',
    'documentDateFrom',
    'documentDateTo',
    'createdFrom',
    'createdTo',
    'search',
    'page',
    'limit',
  ]);
  const sortBy = q.sortBy ?? 'createdAt';
  const sortOrder = q.sortOrder ?? 'desc';
  if (
    typeof sortBy !== 'string' ||
    ![
      'createdAt',
      'receivedAt',
      'documentNumber',
      'warehouseNameSnapshot',
      'status',
    ].includes(sortBy)
  )
    invalid('Некорректная сортировка.');
  if (sortOrder !== 'asc' && sortOrder !== 'desc')
    invalid('Некорректное направление сортировки.');
  const id = (key: string) =>
    q[key] === undefined ? undefined : stockId(q[key], key);
  const positive = (key: string, fallback: number, max: number) => {
    if (q[key] === undefined) return fallback;
    if (
      typeof q[key] !== 'string' ||
      !/^[1-9]\d{0,9}$/.test(q[key]) ||
      Number(q[key]) > max
    )
      invalid('Некорректная пагинация.');
    return Number(q[key]);
  };
  if (q.source !== undefined && q.source !== 'MANUAL' && q.source !== 'ONE_C')
    invalid('Некорректный источник.');
  const status =
    q.status === undefined
      ? ['RECEIVED', 'PLACING']
      : text(q.status).split(',');
  if (
    status.some(
      (s) =>
        !['RECEIVED', 'PLACING', 'PLACED', 'CANCELLED', 'CONFLICT'].includes(s),
    )
  )
    invalid('Некорректный статус.');
  if (
    q.hasProblems !== undefined &&
    q.hasProblems !== 'true' &&
    q.hasProblems !== 'false'
  )
    invalid('Некорректный фильтр проблем.');
  if (
    q.hasConflict !== undefined &&
    q.hasConflict !== 'true' &&
    q.hasConflict !== 'false'
  )
    invalid('Некорректный фильтр конфликтов.');
  if (
    q.attention !== undefined &&
    (typeof q.attention !== 'string' ||
      !['WAREHOUSE', 'ITEMS', 'MANUAL_DUPLICATE'].includes(q.attention))
  )
    invalid('Некорректный фильтр внимания.');
  const timestamp = (key: string) => {
    if (q[key] === undefined) return undefined;
    if (
      typeof q[key] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        q[key],
      ) ||
      !Number.isFinite(Date.parse(q[key]))
    )
      invalid('Укажите ISO datetime с часовым поясом.');
    documentDate(q[key].slice(0, 10));
    return new Date(q[key]);
  };
  const page = positive('page', 1, 2147483647),
    limit = positive('limit', 50, 100),
    offset = (page - 1) * limit;
  if (offset > 2147483647) invalid('Слишком большая страница.');
  const createdFrom = timestamp('createdFrom'),
    createdTo = timestamp('createdTo');
  if (createdFrom && createdTo && createdFrom > createdTo)
    invalid('Некорректный период.');
  const documentDateFrom = documentDate(q.documentDateFrom) ?? undefined;
  const documentDateTo = documentDate(q.documentDateTo) ?? undefined;
  if (documentDateFrom && documentDateTo && documentDateFrom > documentDateTo)
    invalid('Дата начала периода позже даты окончания.');
  return {
    sortBy: sortBy as
      | 'createdAt'
      | 'receivedAt'
      | 'documentNumber'
      | 'warehouseNameSnapshot'
      | 'status',
    sortOrder: sortOrder === 'asc' ? ('asc' as const) : ('desc' as const),
    includeConflicts: q.status === undefined || status.includes('CONFLICT'),
    warehouseId: id('warehouseId'),
    itemId: id('itemId'),
    source: q.source,
    status: status.filter((s) => s !== 'CONFLICT'),
    attention: q.attention as
      undefined | 'WAREHOUSE' | 'ITEMS' | 'MANUAL_DUPLICATE',
    hasProblems: q.hasProblems,
    hasConflict: q.hasConflict,
    createdByUserId: optionalText(q.createdByUserId, 255) ?? undefined,
    createdFrom,
    createdTo,
    documentDateFrom,
    documentDateTo,
    search: optionalText(q.search, 100),
    page,
    limit,
    offset,
  };
}
