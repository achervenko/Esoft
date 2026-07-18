import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
} from './equipment-events.errors';
import {
  type EquipmentEventChecklistAssignment,
  type UpdateCreatedEquipmentEventData,
} from './equipment-events.validation';
import {
  type CurrentChecklistAssignment,
  type UpdateCreatedEventChangeInput,
} from './equipment-events-update.types';
import { normalizeStringIds } from './equipment-events-update.utils';

export function assertVersionMatches(
  currentVersion: number,
  expectedVersion: number,
) {
  if (currentVersion !== expectedVersion) {
    throwEquipmentEventConflict(
      'EVENT_VERSION_CONFLICT',
      'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
    );
  }
}

export function hasCreatedEventChanges(
  updateInput: UpdateCreatedEventChangeInput,
  data: UpdateCreatedEquipmentEventData,
  hasChecklistAssignmentChanges: boolean,
) {
  return (
    updateInput.equipmentId !== undefined ||
    updateInput.eventTypeId !== undefined ||
    hasChecklistAssignmentChanges ||
    hasNoteChange(updateInput.currentNote, data.note) ||
    hasPlannedDateChange(updateInput.currentPlannedDate, data.plannedDate) ||
    hasResponsibleUsersChange(
      updateInput.currentResponsibleUserIds,
      data.responsibleUserIds,
    )
  );
}

export function hasResponsibleUsersChange(
  currentIds: string[],
  nextIds?: string[],
) {
  if (!nextIds) {
    return false;
  }

  return (
    normalizeStringIds(currentIds).join(',') !==
    normalizeStringIds(nextIds).join(',')
  );
}

export function hasChecklistAssignmentsChange(
  currentAssignments: CurrentChecklistAssignment[],
  nextAssignments?: EquipmentEventChecklistAssignment[],
) {
  if (!nextAssignments) {
    return false;
  }

  if (currentAssignments.length !== nextAssignments.length) {
    return true;
  }

  return currentAssignments.some((currentAssignment, index) => {
    const nextAssignment = nextAssignments[index];

    return (
      currentAssignment.assignedUserId !== nextAssignment.assignedUserId ||
      currentAssignment.checklistTemplateId !==
        nextAssignment.checklistTemplateId
    );
  });
}

export function assertChecklistAssignmentsMatchResponsibles(
  assignments: EquipmentEventChecklistAssignment[],
  responsibleUserIds: string[],
) {
  const responsibleUserIdSet = new Set(responsibleUserIds);

  if (
    responsibleUserIdSet.size === 0 ||
    assignments.length !== responsibleUserIdSet.size
  ) {
    throwEquipmentEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  }

  const assignedUserIds = new Set<string>();

  for (const assignment of assignments) {
    if (!responsibleUserIdSet.has(assignment.assignedUserId)) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
        'Исполнитель чек-листа должен быть ответственным за событие.',
      );
    }

    if (assignedUserIds.has(assignment.assignedUserId)) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNEE_DUPLICATE',
        'Ответственному можно назначить только один чек-лист.',
      );
    }

    assignedUserIds.add(assignment.assignedUserId);
  }
}

function hasPlannedDateChange(currentValue: Date | null, nextValue?: Date) {
  if (!nextValue) {
    return false;
  }

  return currentValue?.getTime() !== nextValue.getTime();
}

function hasNoteChange(currentValue: string | null, nextValue?: string | null) {
  return nextValue !== undefined && currentValue !== nextValue;
}
