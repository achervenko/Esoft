import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import {
  equipmentEventExecutionTypeLabels,
  equipmentEventStatusLabels,
  formatChecklistCompletionSummary,
  formatDateValue,
  formatEventResponsibles,
} from "./equipment-events-utils";

type EquipmentEventsTableProps = {
  canEditEvents: boolean;
  canManageEvents: boolean;
  events: EquipmentEventItem[];
  onCancel: (event: EquipmentEventItem) => void;
  onEdit: (event: EquipmentEventItem) => void;
  onOpen: (event: EquipmentEventItem) => void;
};

const columns = (
  canEditEvents: boolean,
  canManageEvents: boolean,
  handlers: Pick<EquipmentEventsTableProps, "onCancel" | "onEdit" | "onOpen">,
): Array<DataTableColumn<EquipmentEventItem, string>> => [
  {
    key: "maintenanceType",
    label: "Вид обслуживания",
    render: (event) => <strong>{event.maintenanceType.name}</strong>,
    sortValue: (event) => event.maintenanceType.name,
  },
  {
    key: "status",
    label: "Статус",
    render: (event) => (
      <span className={`equipment-event-status ${event.status.toLowerCase()}`}>
        {equipmentEventStatusLabels[event.status]}
      </span>
    ),
    sortValue: (event) => equipmentEventStatusLabels[event.status],
  },
  {
    key: "plannedDate",
    label: "Плановая дата",
    render: (event) => formatDateValue(event.plannedDate),
    sortValue: (event) => event.plannedDate ?? "0000-01-01",
  },
  {
    key: "factDate",
    label: "Фактическая дата",
    render: (event) => formatDateValue(event.factDate),
    sortValue: (event) => event.factDate ?? "0000-01-01",
  },
  {
    key: "executionType",
    label: "Выполнение",
    render: (event) => equipmentEventExecutionTypeLabels[event.executionType],
    sortValue: (event) =>
      equipmentEventExecutionTypeLabels[event.executionType],
  },
  {
    key: "responsibles",
    label: "Ответственные",
    render: (event) =>
      event.responsibles.length > 0 ? (
        <div className="equipment-event-responsibles-list">
          {event.responsibles.map((employee) => (
            <span key={employee.id}>{employee.fullName}</span>
          ))}
        </div>
      ) : (
        "Не указаны"
      ),
    sortValue: (event) => formatEventResponsibles(event.responsibles),
  },
  {
    key: "checklists",
    label: "Чек-листы",
    render: (event) => formatChecklistCompletionSummary(event.checklists),
    sortValue: (event) => formatChecklistCompletionSummary(event.checklists),
  },
  {
    key: "actions",
    label: "",
    render: (event) => {
      return (
        <div className="equipment-events-actions">
          <button onClick={() => handlers.onOpen(event)} type="button">
            Открыть
          </button>
          {canEditEvents && event.status === "CREATED" ? (
            <button onClick={() => handlers.onEdit(event)} type="button">
              Изменить
            </button>
          ) : null}
          {canManageEvents &&
          (event.status === "CREATED" || event.status === "IN_PROGRESS") ? (
            <button
              className="equipment-events-danger-button"
              onClick={() => handlers.onCancel(event)}
              type="button"
            >
              Отменить
            </button>
          ) : null}
        </div>
      );
    },
  },
];

export function EquipmentEventsTable({
  canEditEvents,
  canManageEvents,
  events,
  onCancel,
  onEdit,
  onOpen,
}: EquipmentEventsTableProps) {
  return (
    <DataTable
      columns={columns(canEditEvents, canManageEvents, {
        onCancel,
        onEdit,
        onOpen,
      })}
      defaultSort={{ direction: "desc", key: "plannedDate" }}
      getRowKey={(event) => event.id}
      onRowDoubleClick={onOpen}
      rows={events}
    />
  );
}
