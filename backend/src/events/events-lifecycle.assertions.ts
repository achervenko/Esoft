import { EventStatus } from '@prisma/client';
import { throwEventConflict, throwEventForbidden } from './events.errors';

export function requireLifecycleUserId(userId?: string | null): string {
  if (!userId) {
    throwEventForbidden('SESSION_REQUIRED', 'Сессия пользователя не найдена.');
  }

  return userId;
}

export function assertEventVersionMatches(
  currentVersion: number,
  expectedVersion?: number,
): void {
  if (expectedVersion === undefined) {
    return;
  }

  if (currentVersion !== expectedVersion) {
    throwEventConflict(
      'EVENT_VERSION_CONFLICT',
      'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
    );
  }
}

export function assertEventStatus(
  currentStatus: EventStatus,
  allowedStatuses: readonly EventStatus[],
  message: string,
): void {
  if (!allowedStatuses.includes(currentStatus)) {
    throwEventConflict('EVENT_STATUS_CONFLICT', message);
  }
}
