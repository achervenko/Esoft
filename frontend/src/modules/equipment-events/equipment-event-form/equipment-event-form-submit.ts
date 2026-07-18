import type { EquipmentEventItem } from "../../../shared/api/equipment-events/equipment-events.types";
import type {
  EquipmentEventFormMode,
  EquipmentEventFormPayload,
} from "../equipment-event-form.types";
import {
  buildChecklistAssignments,
  buildUpdatePayload,
} from "../equipment-event-form.utils";
import {
  validateChecklistAssignments,
  validateMaintenanceType,
  validatePlannedDate,
  validateResponsibles,
} from "../equipment-event-form.validation";

type PrepareEquipmentEventFormSubmitParams = {
  checklistTemplateIdsByResponsible: Record<string, string>;
  equipmentVisibleId?: number;
  event: EquipmentEventItem | null;
  maintenanceTypeId: string;
  mode: EquipmentEventFormMode;
  note: string;
  plannedDate: string;
  responsibleUserIds: string[];
  unavailableResponsibleIds: Set<string>;
};

export function prepareEquipmentEventFormSubmit(
  params: PrepareEquipmentEventFormSubmitParams,
): { error: string } | { payload: EquipmentEventFormPayload } {
  const parsedMaintenanceTypeId = Number(params.maintenanceTypeId);
  const maintenanceTypeError = validateMaintenanceType(parsedMaintenanceTypeId);

  if (maintenanceTypeError) {
    return { error: maintenanceTypeError };
  }

  const plannedDateError = validatePlannedDate(params.plannedDate);

  if (plannedDateError) {
    return { error: plannedDateError };
  }

  const uniqueResponsibleUserIds = [...new Set(params.responsibleUserIds)];
  const responsiblesError = validateResponsibles(
    uniqueResponsibleUserIds,
    params.unavailableResponsibleIds,
  );

  if (responsiblesError) {
    return { error: responsiblesError };
  }

  const checklistAssignments = buildChecklistAssignments(
    uniqueResponsibleUserIds,
    params.checklistTemplateIdsByResponsible,
  );
  const checklistAssignmentsError = validateChecklistAssignments(
    checklistAssignments,
    new Set(uniqueResponsibleUserIds),
  );

  if (checklistAssignmentsError) {
    return { error: checklistAssignmentsError };
  }

  const normalizedNote = params.note.trim() || null;

  if (params.mode === "edit" && params.event) {
    const updatePayload = buildUpdatePayload({
      checklistAssignments,
      equipmentVisibleId:
        params.equipmentVisibleId ?? params.event.equipment.visibleId,
      event: params.event,
      maintenanceTypeId: parsedMaintenanceTypeId,
      note: normalizedNote,
      plannedDate: params.plannedDate,
      responsibleUserIds: uniqueResponsibleUserIds,
    });

    if (Object.keys(updatePayload).length === 1) {
      return { error: "Нет изменений для сохранения." };
    }

    return {
      payload: {
        checklistAssignments,
        maintenanceTypeId: parsedMaintenanceTypeId,
        note: normalizedNote,
        plannedDate: params.plannedDate,
        responsibleUserIds: uniqueResponsibleUserIds,
        updatePayload,
      },
    };
  }

  return {
    payload: {
      checklistAssignments,
      maintenanceTypeId: parsedMaintenanceTypeId,
      note: normalizedNote,
      plannedDate: params.plannedDate,
      responsibleUserIds: uniqueResponsibleUserIds,
    },
  };
}
