import type {
  EquipmentEventChecklistStatus,
  EquipmentEventSource,
  EquipmentEventStatus,
} from "../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceExecutionType } from "../../shared/api/maintenance/maintenance.types";

export const equipmentEventStatusLabels: Record<EquipmentEventStatus, string> =
  {
    CANCELLED: "Отменено",
    COMPLETED: "Завершено",
    CREATED: "Назначено",
    IN_PROGRESS: "В работе",
  };

export const equipmentEventSourceLabels: Record<EquipmentEventSource, string> =
  {
    MANUAL: "Создано вручную",
    PLANNED: "Создано планированием",
  };

export const equipmentEventExecutionTypeLabels: Record<
  MaintenanceExecutionType,
  string
> = {
  EXTERNAL: "Внешнее",
  INTERNAL: "Внутреннее",
};

export const equipmentEventChecklistStatusLabels: Record<
  EquipmentEventChecklistStatus,
  string
> = {
  CANCELLED: "Отменён",
  COMPLETED: "Завершён",
  CREATED: "Назначен",
  IN_PROGRESS: "В работе",
  INVALIDATED: "Недействителен",
};

export function formatDateValue(date: string | null) {
  if (!date) {
    return "Не указана";
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateMatch) {
    return date;
  }

  const [, year, month, day] = dateMatch;

  return `${day}.${month}.${year}`;
}

export function formatEventResponsibles(
  responsibles: Array<{ fullName: string }>,
) {
  return responsibles.map((employee) => employee.fullName).join(", ") || "Не указаны";
}
