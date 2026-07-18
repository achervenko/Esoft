import type {
  EquipmentEventChecklist,
  EquipmentEventChecklistAssignment,
  EquipmentEventItem,
  UpdateCreatedEquipmentEventPayload,
} from "../../shared/api/equipment-events/equipment-events.types";

export function normalizeIds(ids: string[]) {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

export function buildChecklistAssignments(
  responsibleUserIds: string[],
  checklistTemplateIdsByResponsible: Record<string, string>,
): EquipmentEventChecklistAssignment[] {
  return responsibleUserIds.map((responsibleUserId) => ({
    assignedUserId: responsibleUserId,
    checklistTemplateId: Number(
      checklistTemplateIdsByResponsible[responsibleUserId] ?? NaN,
    ),
  }));
}

export function getChecklistTemplateIdsByResponsible(
  checklists: EquipmentEventChecklist[],
): Record<string, string> {
  return Object.fromEntries(
    [...checklists]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
      .map((checklist) => [
        checklist.assignedUserId,
        String(checklist.checklistTemplateId),
      ]),
  );
}

export function buildUpdatePayload(params: {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  equipmentVisibleId: number;
  event: EquipmentEventItem;
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
}): UpdateCreatedEquipmentEventPayload {
  const updatePayload: UpdateCreatedEquipmentEventPayload = {
    version: params.event.version,
  };
  const currentResponsibleUserIds = params.event.responsibles.map((user) => user.id);
  const hasResponsibleSetChange =
    normalizeIds(params.responsibleUserIds).join(",") !==
    normalizeIds(currentResponsibleUserIds).join(",");
  const hasEquipmentChange =
    params.equipmentVisibleId !== params.event.equipment.visibleId;
  const hasMaintenanceTypeChange =
    params.maintenanceTypeId !== params.event.maintenanceType.id;

  if (hasMaintenanceTypeChange) {
    updatePayload.maintenanceTypeId = params.maintenanceTypeId;
  }

  if (hasEquipmentChange) {
    updatePayload.equipmentVisibleId = params.equipmentVisibleId;
  }

  if (params.plannedDate !== params.event.plannedDate) {
    updatePayload.plannedDate = params.plannedDate;
  }

  if (params.note !== params.event.note) {
    updatePayload.note = params.note;
  }

  if (hasResponsibleSetChange) {
    updatePayload.responsibleUserIds = params.responsibleUserIds;
  }

  if (
    hasResponsibleSetChange ||
    hasEquipmentChange ||
    hasMaintenanceTypeChange ||
    hasChecklistAssignmentsChange(params.event.checklists, params.checklistAssignments)
  ) {
    updatePayload.checklistAssignments = params.checklistAssignments;
  }

  return updatePayload;
}

function hasChecklistAssignmentsChange(
  currentChecklists: EquipmentEventChecklist[],
  nextAssignments: EquipmentEventChecklistAssignment[],
) {
  if (currentChecklists.length !== nextAssignments.length) {
    return true;
  }

  const currentAssignments = [...currentChecklists]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id)
    .map((checklist) => ({
      assignedUserId: checklist.assignedUserId,
      checklistTemplateId: checklist.checklistTemplateId,
    }));

  return currentAssignments.some((currentAssignment, index) => {
    const nextAssignment = nextAssignments[index];

    return (
      currentAssignment.assignedUserId !== nextAssignment.assignedUserId ||
      currentAssignment.checklistTemplateId !== nextAssignment.checklistTemplateId
    );
  });
}
