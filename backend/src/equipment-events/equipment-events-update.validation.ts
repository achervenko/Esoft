import { throwEquipmentEventBadRequest } from './equipment-events.errors';
import {
  parseOptionalNullableText,
  parseOptionalPositiveInteger,
  parsePositiveInteger,
  parseRequiredDate,
  parseResponsibleUserIds,
} from './equipment-events-validation.utils';
import {
  type UpdateCreatedEquipmentEventData,
  type UpdateCreatedEquipmentEventDto,
} from './equipment-events.validation.types';

export function parseUpdateCreatedEventDto(
  dto: UpdateCreatedEquipmentEventDto | undefined,
): UpdateCreatedEquipmentEventData {
  const body = dto ?? {};

  const data: UpdateCreatedEquipmentEventData = {
    equipmentVisibleId: parseOptionalPositiveInteger(
      body.equipmentVisibleId,
      'EQUIPMENT_INVALID',
      'Некорректный ID оборудования.',
    ),
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
    maintenanceTypeId: parseOptionalPositiveInteger(
      body.maintenanceTypeId,
      'MAINTENANCE_TYPE_INVALID',
      'Некорректный вид обслуживания.',
    ),
    note:
      body.note === undefined
        ? undefined
        : parseOptionalNullableText(body.note, 'NOTE_INVALID'),
    responsibleUserIds:
      body.responsibleUserIds === undefined
        ? undefined
        : parseResponsibleUserIds(body.responsibleUserIds),
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };

  if (
    data.equipmentVisibleId === undefined &&
    data.maintenanceTypeId === undefined &&
    data.note === undefined &&
    data.plannedDate === undefined &&
    data.responsibleUserIds === undefined
  ) {
    throwEquipmentEventBadRequest(
      'UPDATE_EMPTY',
      'Укажите данные для изменения события.',
    );
  }

  return data;
}
