import { throwEventBadRequest, throwEventConflict } from './events.errors';
import type { EventChecklistAssignment } from './event-checklists/event-checklists.types';
import type {
  CurrentCreatedEventState,
  UpdateCreatedEventData,
} from './events-update.types';
import { normalizeStringIds } from './events-update.utils';

export function assertVersionMatches(
  currentVersion: number,
  expectedVersion: number,
): void {
  if (currentVersion !== expectedVersion) {
    throwEventConflict(
      'EVENT_VERSION_CONFLICT',
      'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
    );
  }
}

export function hasCreatedEventChanges(
  updateInput: CurrentCreatedEventState,
  data: UpdateCreatedEventData,
  options: {
    hasChecklistAssignmentChanges: boolean;
    hasExtensionChanges: boolean;
  },
): boolean {
  return (
    options.hasExtensionChanges ||
    options.hasChecklistAssignmentChanges ||
    hasNoteChange(updateInput.currentNote, data.note) ||
    hasPlannedDateChange(updateInput.currentPlannedDate, data.plannedDate) ||
    hasTitleChange(updateInput.currentTitle, data.title) ||
    hasResponsibleUsersChange(
      updateInput.currentResponsibleUserIds,
      data.responsibleUserIds,
    )
  );
}

export function hasResponsibleUsersChange(
  currentIds: string[],
  nextIds?: string[],
): boolean {
  if (!nextIds) {
    return false;
  }

  return (
    normalizeStringIds(currentIds).join(',') !==
    normalizeStringIds(nextIds).join(',')
  );
}

export function hasChecklistAssignmentsChange(
  currentAssignments: EventChecklistAssignment[],
  nextAssignments?: EventChecklistAssignment[],
): boolean {
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
  assignments: EventChecklistAssignment[],
  responsibleUserIds: string[],
): void {
  const responsibleUserIdSet = new Set(responsibleUserIds);

  if (
    responsibleUserIdSet.size === 0 ||
    assignments.length !== responsibleUserIdSet.size
  ) {
    throwEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  }

  const assignedUserIds = new Set<string>();

  for (const assignment of assignments) {
    if (!responsibleUserIdSet.has(assignment.assignedUserId)) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
        'Исполнитель чек-листа должен быть ответственным за событие.',
      );
    }

    if (assignedUserIds.has(assignment.assignedUserId)) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNEE_DUPLICATE',
        'Ответственному можно назначить только один чек-лист.',
      );
    }

    assignedUserIds.add(assignment.assignedUserId);
  }
}

function hasPlannedDateChange(currentValue: Date, nextValue?: Date): boolean {
  if (!nextValue) {
    return false;
  }

  return currentValue.getTime() !== nextValue.getTime();
}

function hasNoteChange(
  currentValue: string | null,
  nextValue?: string | null,
): boolean {
  return nextValue !== undefined && currentValue !== nextValue;
}

function hasTitleChange(currentValue: string, nextValue?: string): boolean {
  return nextValue !== undefined && currentValue !== nextValue;
}
