import { BadRequestException } from '@nestjs/common';

export type CreateNotification = {
  eventKey: string;
  type: string;
  title: string;
  body: string;
  targetPath?: string | null;
  occurredAt: Date;
  recipientIds: readonly string[];
};

function invalid(message: string): never {
  throw new BadRequestException({ code: 'NOTIFICATION_INVALID', message });
}

function validText(value: unknown, limit: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= limit &&
    !value.includes('\0')
  );
}

export function validateNotification(input: CreateNotification) {
  if (
    !validText(input.eventKey, 255) ||
    !validText(input.type, 100) ||
    !validText(input.title, 255) ||
    !validText(input.body, 10000) ||
    !(input.occurredAt instanceof Date) ||
    !Number.isFinite(+input.occurredAt)
  )
    invalid('Некорректные данные уведомления.');

  if (
    !Array.isArray(input.recipientIds) ||
    !input.recipientIds.length ||
    input.recipientIds.some((id) => !validText(id, 255))
  )
    invalid('Укажите получателей уведомления.');

  if (input.targetPath != null) {
    const path = input.targetPath;
    if (
      !validText(path, 2000) ||
      !/^#?\//.test(path) ||
      /^#?\/\//.test(path) ||
      /[\\\s\u0000-\u001f\u007f]/.test(path) ||
      /^#?\/(?:%2f|%5c)/i.test(path) ||
      /%0[09ad]|%5c/i.test(path)
    )
      invalid('Ссылка должна быть внутренним маршрутом ESoft.');
  }
  return [...new Set(input.recipientIds)].sort();
}

export function parseNotificationList(query: Record<string, unknown>) {
  const { filter = 'all', limit = '25', cursor } = query;
  if (filter !== 'all' && filter !== 'unread')
    invalid('Некорректный фильтр уведомлений.');
  if (
    typeof limit !== 'string' ||
    !/^[1-9]\d{0,2}$/.test(limit) ||
    Number(limit) > 100
  )
    invalid('Лимит должен быть от 1 до 100.');
  if (
    cursor !== undefined &&
    (typeof cursor !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        cursor,
      ))
  )
    invalid('Некорректный курсор.');
  return { unread: filter === 'unread', limit: Number(limit), cursor };
}
