import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { EquipmentEventsTable } from "./EquipmentEventsTable";

type EquipmentEventsPanelStateProps = {
  canEditEvents: boolean;
  canManageEvents: boolean;
  currentUserId?: string | null;
  events: EquipmentEventItem[];
  isLoading: boolean;
  onCancel: (event: EquipmentEventItem) => void;
  onComplete: (event: EquipmentEventItem) => void;
  onEdit: (event: EquipmentEventItem) => void;
  onOpen: (event: EquipmentEventItem) => void;
  onStart: (event: EquipmentEventItem) => void;
};

export function EquipmentEventsPanelState({
  canEditEvents,
  canManageEvents,
  currentUserId = null,
  events,
  isLoading,
  onCancel,
  onComplete,
  onEdit,
  onOpen,
  onStart,
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
      currentUserId={currentUserId}
      events={events}
      onCancel={onCancel}
      onComplete={onComplete}
      onEdit={onEdit}
      onOpen={onOpen}
      onStart={onStart}
    />
  );
}
