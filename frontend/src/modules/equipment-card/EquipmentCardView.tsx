import { Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EquipmentCard,
  EquipmentHistoryItem,
} from "../../shared/api/equipment/equipment.types";
import { getEquipmentFiles } from "../../shared/api/equipment-files/equipment-files.api";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { EquipmentDocumentsPanel } from "../equipment-documents";
import { EquipmentEventsPanel } from "../equipment-events";
import { MaintenanceSettingsPanel } from "../equipment-maintenance-settings";
import { EquipmentCardGrid } from "./EquipmentCardGrid";
import { EquipmentHistoryView } from "./EquipmentHistoryView";
import { EquipmentMainDataSection } from "./EquipmentMainDataSection";
import { EquipmentTextBlock } from "./EquipmentTextBlock";
import {
  getEquipmentCardSections,
  getEquipmentCardTextBlocks,
} from "./equipment-card-view-model";
import type { EquipmentViewTab } from "./equipment-card-tabs";
import "./EquipmentCardView.css";

type EquipmentCardViewProps = {
  canEdit?: boolean;
  canManageEquipmentEvents?: boolean;
  canManageMaintenanceSettings?: boolean;
  currentUserId?: string | null;
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
  currentUserId = null,
  equipment,
  history,
  historyError = null,
  initialTab = "details",
  isHistoryLoading = false,
  onTabChange,
  returnTo,
}: EquipmentCardViewProps) {
  const [activeTab, setActiveTab] = useState<EquipmentViewTab>(initialTab);
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const [filesVisibleId, setFilesVisibleId] = useState<number | null>(null);
  const filesVisibleIdRef = useRef<number | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const sections = getEquipmentCardSections(equipment);
  const [mainSection, ...secondarySections] = sections;
  const textBlocks = getEquipmentCardTextBlocks(equipment);
  const equipmentPhotos = useMemo(
    () =>
      filesVisibleId === equipment.visibleId
        ? files.filter((file) => file.documentType === "equipment_photo")
        : [],
    [equipment.visibleId, files, filesVisibleId],
  );
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

  useEffect(() => {
    let isMounted = true;

    if (activeTab !== "details") {
      return () => {
        isMounted = false;
      };
    }

    setIsFilesLoading(filesVisibleIdRef.current !== equipment.visibleId);
    setFilesError(null);

    getEquipmentFiles(equipment.visibleId)
      .then((fileItems) => {
        if (isMounted) {
          setFiles(fileItems);
          filesVisibleIdRef.current = equipment.visibleId;
          setFilesVisibleId(equipment.visibleId);
          setFilesError(null);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          if (filesVisibleIdRef.current !== equipment.visibleId) {
            setFiles([]);
            setFilesVisibleId(equipment.visibleId);
          }

          setFilesError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsFilesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, equipment.visibleId]);

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

      <div className="equipment-card-tabs" role="tablist">
        <button
          aria-selected={activeTab === "details"}
          className={activeTab === "details" ? "active" : undefined}
          onClick={() => updateActiveTab("details")}
          role="tab"
          type="button"
        >
          Карточка
        </button>
        <button
          aria-selected={activeTab === "documents"}
          className={activeTab === "documents" ? "active" : undefined}
          onClick={() => updateActiveTab("documents")}
          role="tab"
          type="button"
        >
          Документы
        </button>
        <button
          aria-selected={activeTab === "events"}
          className={activeTab === "events" ? "active" : undefined}
          onClick={() => updateActiveTab("events")}
          role="tab"
          type="button"
        >
          События
        </button>
        <button
          aria-selected={activeTab === "maintenance-settings"}
          className={
            activeTab === "maintenance-settings" ? "active" : undefined
          }
          onClick={() => updateActiveTab("maintenance-settings")}
          role="tab"
          type="button"
        >
          Настройки обслуживания
        </button>
        <button
          aria-selected={activeTab === "history"}
          className={activeTab === "history" ? "active" : undefined}
          onClick={() => updateActiveTab("history")}
          role="tab"
          type="button"
        >
          История изменений
        </button>
      </div>

      {activeTab === "details" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          {mainSection ? (
            <EquipmentMainDataSection
              fields={mainSection.fields}
              isPhotosLoading={isFilesLoading}
              photoError={filesError}
              photos={equipmentPhotos}
              title={mainSection.title}
            />
          ) : null}

          {secondarySections.map((section) => (
            <section
              className="equipment-card-view-section"
              key={section.title}
            >
              <h2>{section.title}</h2>
              <EquipmentCardGrid items={section.fields} />
            </section>
          ))}

          <section className="equipment-card-view-section">
            <h2>Описание</h2>
            {textBlocks.map((block) => (
              <EquipmentTextBlock
                key={block.label}
                label={block.label}
                value={block.value}
              />
            ))}
          </section>
        </section>
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
            currentUserId={currentUserId}
            visibleId={equipment.visibleId}
          />
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          {historyError ? (
            <section className="equipment-card-view-section">
              <h2>История изменений</h2>
              <p className="equipment-card-muted">{historyError}</p>
            </section>
          ) : isHistoryLoading ? (
            <section className="equipment-card-view-section">
              <h2>История изменений</h2>
              <p className="equipment-card-muted">Загрузка истории...</p>
            </section>
          ) : (
            <EquipmentHistoryView history={history} />
          )}
        </section>
      ) : null}
    </article>
  );
}

function navigateWithViewTransition(hashRoute: string) {
  if (window.location.hash === hashRoute) {
    return;
  }

  if (!document.startViewTransition) {
    window.location.hash = hashRoute;
    return;
  }

  try {
    document.startViewTransition(() => {
      window.location.hash = hashRoute;
    });
  } catch {
    window.location.hash = hashRoute;
  }
}
