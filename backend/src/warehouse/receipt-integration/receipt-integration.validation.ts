import { BadRequestException } from '@nestjs/common';
import { receiptSourceVersion } from '../receipts/receipts-import.contract';
export function invalid(message: string): never {
  throw new BadRequestException({
    code: 'WAREHOUSE_RECEIPT_INVALID',
    message,
  });
}
export function record(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((k) => !fields.includes(k)))
    invalid('Переданы неизвестные поля.');
  return body;
}
export function text(value: unknown, max = 255): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.includes('\0') ||
    value.length > max
  )
    invalid('Некорректное текстовое поле.');
  return value.trim();
}
export function parseReceiptEvent(value: unknown) {
  const b = record(value, ['eventId', 'objectId', 'type', 'version']);
  if (
    b.type !== 'RECEIPT_CHANGED' &&
    b.type !== 'RECEIPT_CANCELLED' &&
    b.type !== 'OBJECT_CHANGED'
  )
    invalid('Неизвестное событие.');
  if (
    typeof b.eventId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      b.eventId,
    )
  )
    invalid('Ожидается UUID события.');
  return {
    eventId: b.eventId.toLowerCase(),
    objectId: text(b.objectId),
    type: b.type,
    version:
      b.type === 'OBJECT_CHANGED' && b.version === '0'
        ? '0'
        : receiptSourceVersion(b.version),
  };
}
