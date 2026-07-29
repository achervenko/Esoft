import { EventSource } from '@prisma/client';
import {
  parseChecklistAssignments,
  parseResponsibleUserIds,
} from './events-checklist.validation';
import { throwEventBadRequest } from './events.errors';
import type { CreateEventCommand } from './events-create.types';
import type { UpdateCreatedEventData } from './events-update.types';
import type {
  CancelEventData,
  CompleteEventData,
  StartEventData,
} from './events-lifecycle.types';
import {
  parseOptionalNonEmptyString,
  parseOptionalNullableText,
  parsePositiveInteger,
  parseRequiredDate,
  parseRequiredNonEmptyString,
} from './events.validation.parsers';
import type {
  CancelEventDto,
  CompleteEventDto,
  CreateEventDto,
  StartEventDto,
  UpdateCreatedEventDto,
} from './events.validation.types';

export function parseStartEventDto(
  dto: StartEventDto | undefined,
): StartEventData {
  const body = dto ?? {};

  return {
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}

export function parseCompleteEventDto(
  dto: CompleteEventDto | undefined,
): CompleteEventData {
  const body = dto ?? {};

  return {
    factDate:
      body.factDate === undefined ||
      body.factDate === null ||
      body.factDate === ''
        ? undefined
        : parseRequiredDate(
            body.factDate,
            'FACT_DATE_INVALID',
            'Некорректная фактическая дата.',
          ),
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}

export function parseCancelEventDto(
  dto: CancelEventDto | undefined,
): CancelEventData {
  const body = dto ?? {};

  return {
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}

export function parseCreateEventDto(
  dto: CreateEventDto | undefined,
): CreateEventCommand {
  const body = dto ?? {};

  assertGenericEventPayload(body);

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
    extensionCode: null,
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

export function parseUpdateCreatedEventDto(
  dto: UpdateCreatedEventDto | undefined,
): UpdateCreatedEventData {
  const body = dto ?? {};

  assertGenericEventPayload(body);

  const responsibleUserIds =
    body.responsibleUserIds === undefined
      ? undefined
      : parseResponsibleUserIds(body.responsibleUserIds);

  const data: UpdateCreatedEventData = {
    checklistAssignments:
      body.checklistAssignments === undefined
        ? undefined
        : parseChecklistAssignments(
            body.checklistAssignments,
            responsibleUserIds,
          ),
    note:
      body.note === undefined
        ? undefined
        : parseOptionalNullableText(body.note, 'NOTE_INVALID'),
    plannedDate:
      body.plannedDate === undefined ||
      body.plannedDate === null ||
      body.plannedDate === ''
        ? undefined
        : parseRequiredDate(
            body.plannedDate,
            'PLANNED_DATE_INVALID',
            'Некорректная плановая дата.',
          ),
    responsibleUserIds,
    title: parseOptionalNonEmptyString(
      body.title,
      'TITLE_INVALID',
      'Некорректное название события.',
    ),
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };

  assertUpdateIsNotEmpty(data);

  return data;
}

function assertGenericEventPayload(
  body: Pick<
    CreateEventDto,
    'equipmentId' | 'equipmentVisibleId' | 'extensionCode' | 'maintenanceTypeId'
  >,
): void {
  if (
    body.equipmentId !== undefined ||
    body.equipmentVisibleId !== undefined ||
    body.extensionCode !== undefined ||
    body.maintenanceTypeId !== undefined
  ) {
    throwEventBadRequest(
      'EVENT_EXTENSION_FIELDS_UNSUPPORTED',
      'Общий endpoint события не принимает поля расширения оборудования.',
    );
  }
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

function assertUpdateIsNotEmpty(data: UpdateCreatedEventData): void {
  if (
    data.checklistAssignments === undefined &&
    data.note === undefined &&
    data.plannedDate === undefined &&
    data.responsibleUserIds === undefined &&
    data.title === undefined
  ) {
    throwEventBadRequest(
      'UPDATE_EMPTY',
      'Укажите данные для изменения события.',
    );
  }
}
