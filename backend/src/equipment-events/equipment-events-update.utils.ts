import { throwEquipmentEventBadRequest } from './equipment-events.errors';

export function requireUserId(userId?: string | null): string {
  if (!userId) {
    throwEquipmentEventBadRequest(
      'SESSION_REQUIRED',
      'Сессия пользователя не найдена.',
    );
  }

  return userId;
}
