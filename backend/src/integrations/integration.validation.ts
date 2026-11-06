import { BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { IntegrationEventEnvelope } from './integration.contracts';
export function invalid(message: string): never {
  throw new BadRequestException({ code: 'INTEGRATION_INVALID', message });
}
export function object(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Ожидается объект.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((k) => !fields.includes(k)))
    invalid('Переданы неизвестные поля.');
  return record;
}
export function text(value: unknown, max = 255) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    value.includes('\0')
  )
    invalid('Некорректное текстовое поле.');
  return value.trim();
}
export function eventEnvelope(value: unknown): IntegrationEventEnvelope {
  const b = object(value, ['eventId', 'objectId', 'type', 'version']);
  if (Object.keys(b).length === 1 && 'objectId' in b) {
    const objectId = text(b.objectId);
    if (objectId === '.' || objectId === '..')
      invalid('Некорректный ID объекта.');
    return {
      eventId: randomUUID(),
      objectId,
      type: 'OBJECT_CHANGED',
      version: '0',
    };
  }

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
    type: text(b.type, 100),
    version: text(b.version),
  };
}
export function eventHash(event: IntegrationEventEnvelope) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        event.eventId,
        event.objectId,
        event.type,
        event.version,
      ]),
    )
    .digest('hex');
}

export function integrationId(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
    invalid('Некорректный ID события.');
  return BigInt(value);
}
