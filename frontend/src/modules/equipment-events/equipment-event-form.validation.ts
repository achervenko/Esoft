import type { EquipmentEventChecklistAssignment } from "../../shared/api/equipment-events/equipment-events.types";

export function validateMaintenanceType(maintenanceTypeId: number) {
  if (!Number.isSafeInteger(maintenanceTypeId) || maintenanceTypeId <= 0) {
    return "Выберите вид обслуживания.";
  }

  return null;
}

export function validatePlannedDate(plannedDate: string) {
  if (!plannedDate) {
    return "Укажите плановую дату.";
  }

  return null;
}

export function validateResponsibles(
  responsibleUserIds: string[],
  unavailableResponsibleIds: Set<string>,
) {
  if (responsibleUserIds.length === 0) {
    return "Укажите хотя бы одного ответственного.";
  }

  if (
    responsibleUserIds.some((responsibleUserId) =>
      unavailableResponsibleIds.has(responsibleUserId),
    )
  ) {
    return "Замените ранее назначенных недоступных ответственных перед сохранением.";
  }

  return null;
}

export function validateChecklistAssignments(
  checklistAssignments: EquipmentEventChecklistAssignment[],
  responsibleUserIds: Set<string>,
) {
  if (
    checklistAssignments.some(
      (assignment) =>
        !assignment.assignedUserId ||
        !responsibleUserIds.has(assignment.assignedUserId),
    )
  ) {
    return "Назначьте исполнителя для каждого чек-листа.";
  }

  return null;
}
