import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import {
  equipmentEventExecutionTypeLabels,
  equipmentEventStatusLabels,
  formatDateValue,
  formatEventResponsibles,
} from "./equipment-events-utils";

type EquipmentEventsTableProps = {
  canEditEvents: boolean;
  canManageEvents: boolean;
  currentUserId?: string | null;
  events: EquipmentEventItem[];
  onCancel: (event: EquipmentEventItem) => void;
  onComplete: (event: EquipmentEventItem) => void;
  onEdit: (event: EquipmentEventItem) => void;
  onOpen: (event: EquipmentEventItem) => void;
  onStart: (event: EquipmentEventItem) => void;
};

const columns = (
  canEditEvents: boolean,
  canManageEvents: boolean,
  currentUserId: string | null | undefined,
  handlers: Pick<
    EquipmentEventsTableProps,
    "onCancel" | "onComplete" | "onEdit" | "onOpen" | "onStart"
  >,
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
    key: "actions",
    label: "",
    render: (event) => {
      const canProcessEvent =
        Boolean(currentUserId) &&
        event.responsibles.some((employee) => employee.id === currentUserId);

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
          {canProcessEvent && event.status === "CREATED" ? (
            <button onClick={() => handlers.onStart(event)} type="button">
              Взять в работу
            </button>
          ) : null}
          {canProcessEvent && event.status === "IN_PROGRESS" ? (
            <button onClick={() => handlers.onComplete(event)} type="button">
              Завершить
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
  currentUserId = null,
  events,
  onCancel,
  onComplete,
  onEdit,
  onOpen,
  onStart,
}: EquipmentEventsTableProps) {
  return (
    <DataTable
      columns={columns(canEditEvents, canManageEvents, currentUserId, {
        onCancel,
        onComplete,
        onEdit,
        onOpen,
        onStart,
      })}
      defaultSort={{ direction: "desc", key: "plannedDate" }}
      getRowKey={(event) => event.id}
      onRowDoubleClick={onOpen}
      rows={events}
    />
  );
}
