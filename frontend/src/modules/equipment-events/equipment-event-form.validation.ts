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
  if (checklistAssignments.length !== responsibleUserIds.size) {
    return "Назначьте шаблон чек-листа для каждого ответственного.";
  }

  const assignedUserIds = new Set<string>();

  for (const assignment of checklistAssignments) {
    if (
      !assignment.assignedUserId ||
      !responsibleUserIds.has(assignment.assignedUserId) ||
      !Number.isSafeInteger(assignment.checklistTemplateId) ||
      assignment.checklistTemplateId <= 0
    ) {
      return "Назначьте шаблон чек-листа для каждого ответственного.";
    }

    if (assignedUserIds.has(assignment.assignedUserId)) {
      return "Одному ответственному можно назначить только один чек-лист.";
    }

    assignedUserIds.add(assignment.assignedUserId);
  }

  return null;
}
