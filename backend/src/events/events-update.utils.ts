import { throwEventForbidden } from './events.errors';

export function requireEventUpdateUserId(userId?: string | null): string {
  if (!userId) {
    throwEventForbidden('SESSION_REQUIRED', 'Сессия пользователя не найдена.');
  }

  return userId;
}

export function normalizeStringIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
