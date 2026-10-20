import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { stockId, stockQuantity } from '../stock/stock.validation';

export function adjustmentBadRequest(message: string): never {
  throw new BadRequestException({
    code: 'WAREHOUSE_ADJUSTMENT_INVALID',
    message,
  });
}

export function parseAdjustment(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    adjustmentBadRequest('Ожидается объект корректировки.');
  const input = value as Record<string, unknown>;
  const fields = [
    'itemId',
    'locationId',
    'type',
    'quantity',
    'actualQuantity',
    'expectedQuantity',
    'reason',
    'comment',
    'attachments',
    'requestKey',
  ];
  if (Object.keys(input).some((field) => !fields.includes(field)))
    adjustmentBadRequest('Неизвестное поле корректировки.');
  const itemId = stockId(input.itemId, 'itemId').toString();
  const locationId = stockId(input.locationId, 'locationId').toString();
  const uuid = (entry: unknown) => {
    if (
      typeof entry !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(entry)
    )
      adjustmentBadRequest('Ожидается UUID запроса или загрузки.');
    return entry.toLowerCase();
  };
  const requestKey = uuid(input.requestKey);
  if (
    !Array.isArray(input.attachments) ||
    input.attachments.length < 1 ||
    input.attachments.length > 10
  )
    adjustmentBadRequest('Приложите от 1 до 10 документов.');
  const attachments = input.attachments.map(uuid).sort();
  if (new Set(attachments).size !== attachments.length)
    adjustmentBadRequest('Документы не должны повторяться.');
  if (
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.trim().length > 1000 ||
    input.reason.includes('\0')
  )
    adjustmentBadRequest('Укажите причину длиной до 1000 символов.');
  if (
    input.comment !== undefined &&
    input.comment !== null &&
    (typeof input.comment !== 'string' ||
      input.comment.length > 4000 ||
      input.comment.includes('\0'))
  )
    adjustmentBadRequest('Комментарий должен быть строкой до 4000 символов.');
  const comment =
    typeof input.comment === 'string' ? input.comment.trim() || null : null;
  const common = {
    itemId,
    locationId,
    requestKey,
    attachments,
    reason: input.reason.trim(),
    comment,
  };
  if (input.actualQuantity !== undefined) {
    if (
      input.type !== undefined ||
      input.quantity !== undefined ||
      input.expectedQuantity === undefined
    )
      adjustmentBadRequest(
        'Для фактического количества укажите ожидаемый остаток без type и quantity.',
      );
    return {
      ...common,
      mode: 'ACTUAL' as const,
      actualQuantity: stockQuantity(input.actualQuantity, true).toString(),
      expectedQuantity: stockQuantity(input.expectedQuantity, true).toString(),
    };
  }
  if (
    input.expectedQuantity !== undefined ||
    (input.type !== 'WRITE_OFF' && input.type !== 'SURPLUS')
  )
    adjustmentBadRequest(
      'Укажите WRITE_OFF или SURPLUS и положительное количество.',
    );
  return {
    ...common,
    mode: 'DELTA',
    type: input.type,
    quantity: stockQuantity(input.quantity).toString(),
  } as const;
}

export type AdjustmentInput = ReturnType<typeof parseAdjustment>;
export function adjustmentHash(input: AdjustmentInput) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function parseAdjustmentQuery(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    adjustmentBadRequest('Ожидается объект параметров.');
  const query = value as Record<string, unknown>;
  if (
    Object.keys(query).some(
      (key) => !['itemId', 'locationId', 'type', 'page', 'limit'].includes(key),
    )
  )
    adjustmentBadRequest('Неизвестный параметр списка.');
  const integer = (key: string, fallback: number) => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== 'string' || !/^[1-9]\d{0,9}$/.test(query[key]))
      adjustmentBadRequest('Некорректная пагинация.');
    return Number(query[key]);
  };
  const page = integer('page', 1),
    limit = integer('limit', 50);
  if (limit > 100 || (page - 1) * limit > 2147483647)
    adjustmentBadRequest('Некорректная пагинация.');
  if (
    query.type !== undefined &&
    query.type !== 'WRITE_OFF' &&
    query.type !== 'SURPLUS'
  )
    adjustmentBadRequest('Некорректный тип корректировки.');
  return {
    page,
    limit,
    itemId:
      query.itemId === undefined ? undefined : stockId(query.itemId, 'itemId'),
    locationId:
      query.locationId === undefined
        ? undefined
        : stockId(query.locationId, 'locationId'),
    type: query.type,
  } as const;
}
