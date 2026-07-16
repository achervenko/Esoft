import { Injectable } from '@nestjs/common';
import { ChecklistStatus, EquipmentEventStatus } from '@prisma/client';
import {
  throwChecklistBadRequest,
  throwChecklistConflict,
  throwChecklistForbidden,
} from '../checklist-common/checklists.errors';

@Injectable()
export class ChecklistWorkAssertions {
  assertAssigned(assignedUserId: string, userId: string) {
    if (assignedUserId !== userId) {
      throwChecklistForbidden(
        'CHECKLIST_NOT_ASSIGNED',
        'Чек-лист назначен другому пользователю.',
      );
    }
  }

  assertEventInProgress(status: EquipmentEventStatus) {
    if (status !== EquipmentEventStatus.IN_PROGRESS) {
      throwChecklistConflict(
        'CHECKLIST_EVENT_NOT_IN_PROGRESS',
        'Событие чек-листа не находится в работе.',
      );
    }
  }

  assertChecklistStatus(
    currentStatus: ChecklistStatus,
    expectedStatus: ChecklistStatus,
  ) {
    if (currentStatus !== expectedStatus) {
      throwChecklistConflict(
        'CHECKLIST_STATUS_CONFLICT',
        'Чек-лист в текущем статусе нельзя изменить.',
      );
    }
  }

  assertVersion(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throwChecklistConflict(
        'CHECKLIST_VERSION_CONFLICT',
        'Чек-лист уже был изменён. Обновите данные.',
      );
    }
  }

  requireUserId(userId?: string | null) {
    if (!userId) {
      throwChecklistBadRequest(
        'SESSION_REQUIRED',
        'Сессия пользователя не найдена.',
      );
    }

    return userId;
  }
}
