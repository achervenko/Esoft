import {
  parseChecklistAssignments,
  parseOptionalNullableText,
  parsePositiveInteger,
  parseRequiredDate,
  parseRequiredFactDate,
  parseResponsibleUserIds,
} from './equipment-events-validation.utils';
import {
  type CompleteEquipmentEventData,
  type CompleteEquipmentEventDto,
  type CreateManualEquipmentEventData,
  type CreateManualEquipmentEventDto,
} from './equipment-events.validation.types';

export function parseCreateManualEventDto(
  dto: CreateManualEquipmentEventDto | undefined,
  equipmentVisibleId: number,
): CreateManualEquipmentEventData {
  const body = dto ?? {};
  const responsibleUserIds = parseResponsibleUserIds(body.responsibleUserIds);

  return {
    checklistAssignments: parseChecklistAssignments(
      body.checklistAssignments,
      responsibleUserIds,
    ),
    equipmentVisibleId: parsePositiveInteger(
      equipmentVisibleId,
      'EQUIPMENT_ID_INVALID',
      'Некорректный ID оборудования.',
    ),
    maintenanceTypeId: parsePositiveInteger(
      body.maintenanceTypeId,
      'MAINTENANCE_TYPE_REQUIRED',
      'Укажите вид обслуживания.',
    ),
    note: parseOptionalNullableText(body.note, 'NOTE_INVALID') ?? null,
    plannedDate: parseRequiredDate(
      body.plannedDate,
      'PLANNED_DATE_REQUIRED',
      'Укажите плановую дату события.',
    ),
    responsibleUserIds,
  };
}

export function parseCompleteEventDto(
  dto: CompleteEquipmentEventDto | undefined,
): CompleteEquipmentEventData {
  if (
    !dto ||
    dto.factDate === undefined ||
    dto.factDate === null ||
    dto.factDate === ''
  ) {
    return {};
  }

  return {
    factDate: parseRequiredFactDate(
      dto.factDate,
      'FACT_DATE_INVALID',
      'Некорректная фактическая дата.',
    ),
  };
}
