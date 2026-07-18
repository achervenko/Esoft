import { Injectable } from '@nestjs/common';
import { ChecklistStatus, EquipmentEventStatus } from '@prisma/client';
import {
  throwChecklistBadRequest,
  throwChecklistConflict,
  throwChecklistForbidden,
} from '../checklist-common/checklists.errors';
import type { LockedEventChecklistRow } from './checklist-work.repository.types';

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

  assertEventCanBeStarted(status: EquipmentEventStatus) {
    if (
      status !== EquipmentEventStatus.CREATED &&
      status !== EquipmentEventStatus.IN_PROGRESS
    ) {
      throwChecklistConflict(
        'CHECKLIST_EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя начать через чек-лист.',
      );
    }
  }

  assertStartAssignments(params: {
    checklists: LockedEventChecklistRow[];
    responsibleUserIds: string[];
  }) {
    if (params.responsibleUserIds.length === 0) {
      throwChecklistBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    if (params.checklists.length === 0) {
      throwChecklistConflict(
        'CHECKLISTS_REQUIRED',
        'У события должен быть хотя бы один чек-лист.',
      );
    }

    const responsibleUserIdSet = new Set(params.responsibleUserIds);
    const checklistAssignedUserIds = params.checklists.map(
      (checklist) => checklist.assignedUserId,
    );
    const checklistAssignedUserIdSet = new Set(checklistAssignedUserIds);

    if (
      checklistAssignedUserIds.length !== responsibleUserIdSet.size ||
      checklistAssignedUserIdSet.size !== responsibleUserIdSet.size
    ) {
      throwChecklistConflict(
        'CHECKLIST_ASSIGNMENTS_REQUIRED',
        'У каждого ответственного должен быть ровно один чек-лист.',
      );
    }

    for (const responsibleUserId of responsibleUserIdSet) {
      if (!checklistAssignedUserIdSet.has(responsibleUserId)) {
        throwChecklistConflict(
          'CHECKLIST_ASSIGNMENTS_REQUIRED',
          'Назначения чек-листов должны полностью соответствовать ответственным события.',
        );
      }
    }

    if (
      params.checklists.some(
        (checklist) => checklist.status !== ChecklistStatus.CREATED,
      )
    ) {
      throwChecklistConflict(
        'CHECKLIST_STATUS_CONFLICT',
        'Перед стартом события все чек-листы должны быть в статусе CREATED.',
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
