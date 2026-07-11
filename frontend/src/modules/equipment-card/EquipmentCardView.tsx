import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import type {
  EquipmentCard,
  EquipmentHistoryItem,
} from "../../shared/api/equipment-api";
import {
  formatNullableNumber,
  formatNullableText,
  formatRuDate,
} from "../../shared/lib/formatters";
import { EquipmentDocumentsPanel } from "../equipment-documents";
import { EquipmentStatusBadge } from "../equipment-status";
import { EquipmentHistoryView } from "./EquipmentHistoryView";
import "./EquipmentCardView.css";

type EquipmentCardViewProps = {
  canEdit?: boolean;
  equipment: EquipmentCard;
  history: EquipmentHistoryItem[];
  isHistoryLoading?: boolean;
};

type EquipmentCardTab = "details" | "documents" | "history";

type EquipmentCardField = {
  label: string;
  value: ReactNode;
};

type EquipmentCardSection = {
  fields: EquipmentCardField[];
  title: string;
};

type EquipmentCardTextBlock = {
  label: string;
  value: string | null;
};

export function EquipmentCardView({
  canEdit = false,
  equipment,
  history,
  isHistoryLoading = false,
}: EquipmentCardViewProps) {
  const [activeTab, setActiveTab] = useState<EquipmentCardTab>("details");
  const sections = getEquipmentCardSections(equipment);
  const textBlocks = getEquipmentCardTextBlocks(equipment);
  const editHref = `#/equipment/${equipment.visibleId}/edit?tab=${activeTab}`;

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
          {sections.map((section) => (
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

function getEquipmentCardSections(
  equipment: EquipmentCard,
): EquipmentCardSection[] {
  return [
    {
      title: "Основные данные",
      fields: [
        { label: "Производитель", value: equipment.manufacturer },
        { label: "Модель", value: equipment.model },
        { label: "Заводской номер", value: equipment.serialNumber ?? "б/н" },
        {
          label: "Статус",
          value: (
            <EquipmentStatusBadge
              label={equipment.statusLabel}
              status={equipment.status}
            />
          ),
        },
      ],
    },
    {
      title: "Местонахождение",
      fields: [
        { label: "Местонахождение", value: equipment.location },
        { label: "Ответственный", value: equipment.responsible },
        { label: "Дата выдачи", value: formatRuDate(equipment.issueDate) },
        { label: "Должность", value: equipment.responsiblePosition },
      ],
    },
    {
      title: "Учетные данные",
      fields: [
        { label: "Инвентарный номер", value: equipment.inventoryNumber },
        { label: "Страна производства", value: equipment.country },
        {
          label: "Год выпуска",
          value: formatNullableNumber(equipment.manufactureYear),
        },
        {
          label: "Дата ввода в эксплуатацию",
          value: formatRuDate(equipment.commissioningDate),
        },
      ],
    },
  ];
}

function getEquipmentCardTextBlocks(
  equipment: EquipmentCard,
): EquipmentCardTextBlock[] {
  return [
    {
      label: "Технические характеристики",
      value: equipment.specifications,
    },
    {
      label: "Технологическая операция",
      value: equipment.operationText,
    },
    {
      label: "Примечание",
      value: equipment.notes,
    },
  ];
}

function EquipmentCardGrid({ items }: { items: EquipmentCardField[] }) {
  return (
    <dl className="equipment-card-view-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EquipmentTextBlock({ label, value }: EquipmentCardTextBlock) {
  return (
    <div className="equipment-card-view-text">
      <h3>{label}</h3>
      <p>{formatNullableText(value)}</p>
    </div>
  );
}
