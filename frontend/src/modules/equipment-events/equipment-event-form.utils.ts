import type {
  EquipmentEventChecklistAssignment,
  EquipmentEventItem,
  UpdateCreatedEquipmentEventPayload,
} from "../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceSettingChecklistTemplate } from "../../shared/api/maintenance/maintenance.types";

export function normalizeIds(ids: string[]) {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

export function buildChecklistAssignments(
  checklistTemplates: MaintenanceSettingChecklistTemplate[],
  checklistAssignees: Record<number, string>,
): EquipmentEventChecklistAssignment[] {
  return checklistTemplates.map((checklistTemplate) => ({
    assignedUserId:
      checklistAssignees[checklistTemplate.checklistTemplateId] ?? "",
    checklistTemplateId: checklistTemplate.checklistTemplateId,
  }));
}

export function buildUpdatePayload(params: {
  event: EquipmentEventItem;
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
}): UpdateCreatedEquipmentEventPayload {
  const updatePayload: UpdateCreatedEquipmentEventPayload = {
    version: params.event.version,
  };

  if (params.maintenanceTypeId !== params.event.maintenanceType.id) {
    updatePayload.maintenanceTypeId = params.maintenanceTypeId;
  }

  if (params.plannedDate !== params.event.plannedDate) {
    updatePayload.plannedDate = params.plannedDate;
  }

  if (params.note !== params.event.note) {
    updatePayload.note = params.note;
  }

  if (
    normalizeIds(params.responsibleUserIds).join(",") !==
    normalizeIds(params.event.responsibles.map((user) => user.id)).join(",")
  ) {
    updatePayload.responsibleUserIds = params.responsibleUserIds;
  }

  return updatePayload;
}
