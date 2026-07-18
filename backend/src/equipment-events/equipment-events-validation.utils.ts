import { throwEquipmentEventBadRequest } from './equipment-events.errors';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation.types';

const BUSINESS_TIME_ZONE = 'Europe/Moscow';

export function parseResponsibleUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    throwEquipmentEventBadRequest(
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
    throwEquipmentEventBadRequest(
      'RESPONSIBLES_REQUIRED',
      'Укажите хотя бы одного ответственного.',
    );
  }

  return ids;
}

export function parseChecklistAssignments(
  value: unknown,
  responsibleUserIds: string[],
  options?: {
    validateResponsibleAssignments?: boolean;
  },
): EquipmentEventChecklistAssignment[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throwEquipmentEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_INVALID',
      'Некорректные назначения чек-листов.',
    );
  }

  const shouldValidateResponsibleAssignments =
    options?.validateResponsibleAssignments ?? true;
  const responsibleUserIdSet = new Set(responsibleUserIds);
  const assignedUserIds = new Set<string>();

  if (value.length === 0) {
    throwEquipmentEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Укажите назначения чек-листов для всех ответственных.',
    );
  }

  const assignments = value.map((item) => {
    if (!item || typeof item !== 'object') {
      throwEquipmentEventBadRequest(
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
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNEE_DUPLICATE',
        'Ответственному можно назначить только один чек-лист.',
      );
    }

    if (
      shouldValidateResponsibleAssignments &&
      responsibleUserIdSet.size > 0 &&
      !responsibleUserIdSet.has(assignedUserId)
    ) {
      throwEquipmentEventBadRequest(
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
    shouldValidateResponsibleAssignments &&
    responsibleUserIdSet.size > 0 &&
    assignments.length !== responsibleUserIdSet.size
  ) {
    throwEquipmentEventBadRequest(
      'CHECKLIST_ASSIGNMENTS_REQUIRED',
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  }

  if (shouldValidateResponsibleAssignments && responsibleUserIdSet.size > 0) {
    for (const responsibleUserId of responsibleUserIdSet) {
      if (!assignedUserIds.has(responsibleUserId)) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_ASSIGNMENTS_REQUIRED',
          'Назначения чек-листов должны полностью покрывать всех ответственных.',
        );
      }
    }
  }

  return assignments;
}

export function parseOptionalNonEmptyString(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredNonEmptyString(value, code, message);
}

export function parseRequiredNonEmptyString(
  value: unknown,
  code: string,
  message: string,
) {
  if (typeof value !== 'string' || value.trim() === '') {
    throwEquipmentEventBadRequest(code, message);
  }

  return value.trim();
}

export function parseOptionalPositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parsePositiveInteger(value, code, message);
}

export function parseOptionalNullableText(value: unknown, code: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throwEquipmentEventBadRequest(code, 'Некорректный комментарий.');
  }

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

export function parsePositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  const numberValue = parseIntegerValue(value);

  if (numberValue === undefined || numberValue <= 0) {
    throwEquipmentEventBadRequest(code, message);
  }

  return numberValue;
}

export function parseOptionalDate(value: unknown, code: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredDate(
    value,
    code,
    'Дата должна быть в формате ГГГГ-ММ-ДД.',
  );
}

export function parseRequiredFactDate(
  value: unknown,
  code: string,
  message: string,
) {
  const dateValue = parseDateString(value, code, message);

  if (dateValue > getTodayDateString()) {
    throwEquipmentEventBadRequest(
      'FACT_DATE_IN_FUTURE',
      'Фактическая дата события не может быть позже текущей даты.',
    );
  }

  return new Date(`${dateValue}T00:00:00.000Z`);
}

export function parseIntegerValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined;
  }

  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    const numberValue = Number(value);

    return Number.isSafeInteger(numberValue) ? numberValue : undefined;
  }

  return undefined;
}

export function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function parseRequiredDate(
  value: unknown,
  code: string,
  message: string,
) {
  const dateValue = parseDateString(value, code, message);

  return new Date(`${dateValue}T00:00:00.000Z`);
}

function parseDateString(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throwEquipmentEventBadRequest(code, message);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throwEquipmentEventBadRequest(code, message);
  }

  return value;
}
