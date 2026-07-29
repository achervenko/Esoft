import type { EventChecklistAssignment } from './event-checklists/event-checklists.types';
import { throwEventBadRequest } from './events.errors';
import {
  parsePositiveInteger,
  parseRequiredNonEmptyString,
} from './events.validation.parsers';

export function parseResponsibleUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throwEventBadRequest(
      'RESPONSIBLES_REQUIRED',
      'Укажите ответственных за событие.',
    );
  }

  const ids = [
    ...new Set(
      value.map((item) =>
        parseRequiredNonEmptyString(
          item,
          'RESPONSIBLE_INVALID',
          'Некорректный ответственный.',
        ),
      ),
    ),
  ];

  if (ids.length === 0) {
    throwEventBadRequest(
      'RESPONSIBLES_REQUIRED',
      'Укажите хотя бы одного ответственного.',
    );
  }

  return ids;
}

export function parseChecklistAssignments(
  value: unknown,
  responsibleUserIds?: string[],
): EventChecklistAssignment[] {
  if (!Array.isArray(value)) {
    throwEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_INVALID',
      'Некорректные назначения чек-листов.',
    );
  }

  const assignmentsValue = value;
  const shouldValidateCoverage = responsibleUserIds !== undefined;
  const responsibleUserIdSet = new Set(responsibleUserIds ?? []);
  const assignedUserIds = new Set<string>();

  if (
    shouldValidateCoverage &&
    responsibleUserIdSet.size > 0 &&
    assignmentsValue.length === 0
  ) {
    throwEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Укажите назначения чек-листов для всех ответственных.',
    );
  }

  const assignments = assignmentsValue.map((item) => {
    if (!item || typeof item !== 'object') {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNMENT_INVALID',
        'Некорректное назначение чек-листа.',
      );
    }

    const payload = item as Record<string, unknown>;
    const checklistTemplateId = parsePositiveInteger(
      payload.checklistTemplateId,
      'CHECKLIST_TEMPLATE_INVALID',
      'Некорректный шаблон чек-листа.',
    );
    const assignedUserId = parseRequiredNonEmptyString(
      payload.assignedUserId,
      'CHECKLIST_ASSIGNED_USER_INVALID',
      'Некорректный исполнитель чек-листа.',
    );

    if (assignedUserIds.has(assignedUserId)) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNEE_DUPLICATE',
        'Ответственному можно назначить только один чек-лист.',
      );
    }

    if (shouldValidateCoverage && !responsibleUserIdSet.has(assignedUserId)) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
        'Исполнитель чек-листа должен быть ответственным за событие.',
      );
    }

    assignedUserIds.add(assignedUserId);

    return {
      assignedUserId,
      checklistTemplateId,
    };
  });

  if (
    shouldValidateCoverage &&
    assignments.length !== responsibleUserIdSet.size
  ) {
    throwEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  }

  return assignments;
}
