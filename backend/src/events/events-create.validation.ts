import { EventSource } from '@prisma/client';
import {
  parseChecklistAssignments,
  parseResponsibleUserIds,
} from './events-checklist.validation';
import { throwEventBadRequest } from './events.errors';
import type { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import type { CreateEventCommand } from './events-create.types';
import {
  parseOptionalNullableText,
  parseRequiredDate,
  parseRequiredNonEmptyString,
} from './events.validation.parsers';
import type { CreateEventDto } from './events.validation.types';

export type CreateEventData = CreateEventCommand & {
  extension?: unknown;
};

export function parseCreateEventDto(
  dto: CreateEventDto | undefined,
  extensionRegistry: EventExtensionRegistry,
): CreateEventData {
  const body = dto ?? {};

  extensionRegistry.assertNoLegacyFields(body);
  const extensionCode = extensionRegistry.parseCreateExtensionCode(
    body.extensionCode,
  );
  const extension = extensionRegistry.parseCreateExtension(
    body.extension,
    extensionCode,
  );

  const plannedDate = parseRequiredPlannedDate(body.plannedDate);
  const responsibleUserIds = parseResponsibleUserIds(body.responsibleUserIds);

  return {
    checklistAssignments:
      body.checklistAssignments === undefined
        ? []
        : parseChecklistAssignments(
            body.checklistAssignments,
            responsibleUserIds,
          ),
    ...(extension !== undefined ? { extension } : {}),
    extensionCode,
    note: parseOptionalNullableText(body.note, 'NOTE_INVALID') ?? null,
    originalPlannedDate: plannedDate,
    plannedDate,
    responsibleUserIds,
    source: EventSource.MANUAL,
    title: parseRequiredNonEmptyString(
      body.title,
      'TITLE_REQUIRED',
      'Укажите название события.',
    ),
  };
}

function parseRequiredPlannedDate(value: unknown): Date {
  if (value === undefined || value === null || value === '') {
    throwEventBadRequest(
      'PLANNED_DATE_REQUIRED',
      'Укажите плановую дату события.',
    );
  }

  return parseRequiredDate(
    value,
    'PLANNED_DATE_INVALID',
    'Некорректная плановая дата.',
  );
}
