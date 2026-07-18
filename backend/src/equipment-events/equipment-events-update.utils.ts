import { throwEquipmentEventBadRequest } from './equipment-events.errors';

export function requireUserId(userId?: string | null) {
  if (!userId) {
    throwEquipmentEventBadRequest(
      'SESSION_REQUIRED',
      'Сессия пользователя не найдена.',
    );
  }

  return userId;
}

export function normalizeStringIds(ids: string[]) {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
