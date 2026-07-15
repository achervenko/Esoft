import type {
  EquipmentEventSource,
  EquipmentEventStatus,
} from "../../shared/api/equipment-events/equipment-events.types";
import type { MaintenanceExecutionType } from "../../shared/api/maintenance/maintenance.types";

export const equipmentEventStatusLabels: Record<EquipmentEventStatus, string> =
  {
    CANCELLED: "Отменено",
    COMPLETED: "Завершено",
    CREATED: "Назначено",
    DRAFT: "Черновик",
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

export function formatDateValue(date: string | null) {
  if (!date) {
    return "Не указана";
  }

  const [year, month, day] = date.split("-");

  return `${day}.${month}.${year}`;
}

export function formatEventResponsibles(
  responsibles: Array<{ fullName: string }>,
) {
  return responsibles.map((employee) => employee.fullName).join(", ") || "Не указаны";
}
