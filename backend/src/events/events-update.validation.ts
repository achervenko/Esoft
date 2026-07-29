import type { EquipmentEventExtensionUpdateInput } from '../equipment-event-extension/equipment-event-extension.command.types';
import {
  parseChecklistAssignments,
  parseResponsibleUserIds,
} from './events-checklist.validation';
import { throwEventBadRequest } from './events.errors';
import {
  assertNoLegacyExtensionFields,
  assertNoUpdateExtensionCode,
  parseUpdateExtension,
} from './events-extension.validation';
import type { UpdateCreatedEventData } from './events-update.types';
import {
  parseOptionalNonEmptyString,
  parseOptionalNullableText,
  parsePositiveInteger,
  parseRequiredDate,
} from './events.validation.parsers';
import type { UpdateCreatedEventDto } from './events.validation.types';

export type UpdateCreatedEventPayload = UpdateCreatedEventData & {
  extension?: EquipmentEventExtensionUpdateInput;
};

export function parseUpdateCreatedEventDto(
  dto: UpdateCreatedEventDto | undefined,
): UpdateCreatedEventPayload {
  const body = dto ?? {};

  assertNoLegacyExtensionFields(body);
  assertNoUpdateExtensionCode(body.extensionCode);
  const extension = parseUpdateExtension(body.extension);

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

  assertUpdateIsNotEmpty(data, extension);

  return {
    ...data,
    ...(extension !== undefined ? { extension } : {}),
  };
}

function assertUpdateIsNotEmpty(
  data: UpdateCreatedEventData,
  extension: EquipmentEventExtensionUpdateInput | undefined,
): void {
  if (
    data.checklistAssignments === undefined &&
    extension === undefined &&
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
