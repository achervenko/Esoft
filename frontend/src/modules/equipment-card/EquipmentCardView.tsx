import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  EquipmentCard,
  EquipmentHistoryItem,
} from "../../shared/api/equipment/equipment.types";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { EquipmentDocumentsPanel } from "../equipment-documents";
import { EquipmentEventsPanel } from "../equipment-events";
import { MaintenanceSettingsPanel } from "../equipment-maintenance-settings";
import { EquipmentCardTabs } from "./EquipmentCardTabs";
import { EquipmentDetailsTab } from "./EquipmentDetailsTab";
import { EquipmentHistoryTab } from "./EquipmentHistoryTab";
import { navigateWithViewTransition } from "./equipment-card-navigation";
import type { EquipmentViewTab } from "./equipment-card-tabs";
import { useEquipmentPhotos } from "./use-equipment-photos";
import "./EquipmentCardView.css";

type EquipmentCardViewProps = {
  canEdit?: boolean;
  canManageEquipmentEvents?: boolean;
  canManageMaintenanceSettings?: boolean;
  equipment: EquipmentCard;
  history: EquipmentHistoryItem[];
  historyError?: string | null;
  initialTab?: EquipmentViewTab;
  isHistoryLoading?: boolean;
  onTabChange?: (tab: EquipmentViewTab) => void;
  returnTo: string;
};

export function EquipmentCardView({
  canEdit = false,
  canManageEquipmentEvents = false,
  canManageMaintenanceSettings = false,
  equipment,
  history,
  historyError = null,
  initialTab = "details",
  isHistoryLoading = false,
  onTabChange,
  returnTo,
}: EquipmentCardViewProps) {
  const [activeTab, setActiveTab] = useState<EquipmentViewTab>(initialTab);
  const {
    error: photosError,
    isLoading: isPhotosLoading,
    photos,
  } = useEquipmentPhotos({
    enabled: activeTab === "details",
    visibleId: equipment.visibleId,
  });
  const editHref = buildHashRoute(`#/equipment/${equipment.visibleId}/edit`, {
    returnTo,
    tab: activeTab === "details" ? null : activeTab,
  });

  const updateActiveTab = (tab: EquipmentViewTab) => {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
    onTabChange?.(tab);
    const hashRoute = buildHashRoute(`#/equipment/${equipment.visibleId}`, {
      returnTo,
      tab: tab === "details" ? null : tab,
    });

    if (window.location.hash !== hashRoute) {
      window.location.hash = hashRoute;
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <article className="equipment-card-view">
      <header className="equipment-card-view-header">
        <div>
          <h1>
            ID {equipment.visibleId} — {equipment.name}
          </h1>
        </div>

        {canEdit && (activeTab === "details" || activeTab === "documents") ? (
          <a
            className="equipment-card-edit-button"
            href={editHref}
            onClick={(event) => {
              event.preventDefault();
              navigateWithViewTransition(editHref);
            }}
          >
            <Pencil aria-hidden="true" size={17} />
            <span>Редактировать</span>
          </a>
        ) : null}
      </header>

      <EquipmentCardTabs activeTab={activeTab} onTabChange={updateActiveTab} />

      {activeTab === "details" ? (
        <EquipmentDetailsTab
          equipment={equipment}
          isPhotosLoading={isPhotosLoading}
          photos={photos}
          photosError={photosError}
        />
      ) : null}

      {activeTab === "documents" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          <EquipmentDocumentsPanel
            mode="view"
            visibleId={equipment.visibleId}
          />
        </section>
      ) : null}

      {activeTab === "maintenance-settings" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          <MaintenanceSettingsPanel
            canManage={canManageMaintenanceSettings}
            visibleId={equipment.visibleId}
          />
        </section>
      ) : null}

      {activeTab === "events" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          <EquipmentEventsPanel
            canManageEvents={canManageEquipmentEvents}
            equipmentStatus={equipment.status}
            visibleId={equipment.visibleId}
          />
        </section>
      ) : null}

      {activeTab === "history" ? (
        <EquipmentHistoryTab
          error={historyError}
          history={history}
          isLoading={isHistoryLoading}
        />
      ) : null}
    </article>
  );
}
