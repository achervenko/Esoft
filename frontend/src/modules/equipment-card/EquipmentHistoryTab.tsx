import type { EquipmentHistoryItem } from "../../shared/api/equipment/equipment.types";
import { getEquipmentPanelId, getEquipmentTabId } from "./EquipmentCardTabs";
import { EquipmentHistoryView } from "./EquipmentHistoryView";

type EquipmentHistoryTabProps = {
  error: string | null;
  history: EquipmentHistoryItem[];
  isLoading: boolean;
};

export function EquipmentHistoryTab({
  error,
  history,
  isLoading,
}: EquipmentHistoryTabProps) {
  return (
    <section
      aria-labelledby={getEquipmentTabId("history")}
      className="equipment-card-tab-panel"
      id={getEquipmentPanelId("history")}
      role="tabpanel"
    >
      {error ? (
        <section className="equipment-card-view-section">
          <h2>История изменений</h2>
          <p className="equipment-card-muted">{error}</p>
        </section>
      ) : isLoading ? (
        <section className="equipment-card-view-section">
          <h2>История изменений</h2>
          <p className="equipment-card-muted">Загрузка истории...</p>
        </section>
      ) : (
        <EquipmentHistoryView history={history} />
      )}
    </section>
  );
}
