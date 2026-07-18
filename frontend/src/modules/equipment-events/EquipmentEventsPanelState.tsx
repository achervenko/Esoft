import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { EquipmentEventsTable } from "./EquipmentEventsTable";

type EquipmentEventsPanelStateProps = {
  canEditEvents: boolean;
  canManageEvents: boolean;
  events: EquipmentEventItem[];
  isLoading: boolean;
  onCancel: (event: EquipmentEventItem) => void;
  onEdit: (event: EquipmentEventItem) => void;
  onOpen: (event: EquipmentEventItem) => void;
};

export function EquipmentEventsPanelState({
  canEditEvents,
  canManageEvents,
  events,
  isLoading,
  onCancel,
  onEdit,
  onOpen,
}: EquipmentEventsPanelStateProps) {
  if (isLoading) {
    return <p className="admin-state">Загрузка событий...</p>;
  }

  if (events.length === 0) {
    return (
      <p className="admin-state">Для этого оборудования пока нет событий.</p>
    );
  }

  return (
    <EquipmentEventsTable
      canEditEvents={canEditEvents}
      canManageEvents={canManageEvents}
      events={events}
      onCancel={onCancel}
      onEdit={onEdit}
      onOpen={onOpen}
    />
  );
}
