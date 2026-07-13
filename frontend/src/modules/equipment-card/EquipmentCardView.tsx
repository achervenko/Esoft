import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  EquipmentCard,
  EquipmentFile,
  EquipmentHistoryItem,
} from "../../shared/api/equipment-api";
import { getEquipmentFiles } from "../../shared/api/equipment-api";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { EquipmentDocumentsPanel } from "../equipment-documents";
import { EquipmentCardGrid } from "./EquipmentCardGrid";
import { EquipmentHistoryView } from "./EquipmentHistoryView";
import { EquipmentMainDataSection } from "./EquipmentMainDataSection";
import { EquipmentTextBlock } from "./EquipmentTextBlock";
import {
  getEquipmentCardSections,
  getEquipmentCardTextBlocks,
} from "./equipment-card-view-model";
import "./EquipmentCardView.css";

type EquipmentCardViewProps = {
  canEdit?: boolean;
  equipment: EquipmentCard;
  history: EquipmentHistoryItem[];
  initialTab?: EquipmentCardTab;
  isHistoryLoading?: boolean;
  returnTo: string;
};

type EquipmentCardTab = "details" | "documents" | "history";

export function EquipmentCardView({
  canEdit = false,
  equipment,
  history,
  initialTab = "details",
  isHistoryLoading = false,
  returnTo,
}: EquipmentCardViewProps) {
  const [activeTab, setActiveTab] = useState<EquipmentCardTab>(initialTab);
  const [files, setFiles] = useState<EquipmentFile[]>([]);
  const sections = getEquipmentCardSections(equipment);
  const [mainSection, ...secondarySections] = sections;
  const textBlocks = getEquipmentCardTextBlocks(equipment);
  const equipmentPhotos = useMemo(
    () => files.filter((file) => file.documentType === "equipment_photo"),
    [files],
  );
  const editHref = buildHashRoute(`#/equipment/${equipment.visibleId}/edit`, {
    returnTo,
    tab: activeTab,
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let isMounted = true;

    getEquipmentFiles(equipment.visibleId)
      .then((fileItems) => {
        if (isMounted) {
          setFiles(fileItems);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFiles([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [equipment.visibleId]);

  return (
    <article className="equipment-card-view">
      <header className="equipment-card-view-header">
        <div>
          <h1>
            ID {equipment.visibleId} — {equipment.name}
          </h1>
        </div>

        {canEdit && activeTab !== "history" ? (
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
          onClick={() => setActiveTab("details")}
          role="tab"
          type="button"
        >
          Карточка
        </button>
        <button
          aria-selected={activeTab === "documents"}
          className={activeTab === "documents" ? "active" : undefined}
          onClick={() => setActiveTab("documents")}
          role="tab"
          type="button"
        >
          Документы
        </button>
        <button
          aria-selected={activeTab === "history"}
          className={activeTab === "history" ? "active" : undefined}
          onClick={() => setActiveTab("history")}
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

      {activeTab === "history" ? (
        <section className="equipment-card-tab-panel" role="tabpanel">
          {isHistoryLoading ? (
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
