import { GripVertical, Pencil, Power } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { ChecklistModule } from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import type { CatalogDragProps, CatalogDragState } from "./catalog-reorder.types";
import { stopCardEvent } from "./catalog-panel.utils";

type CatalogModuleCardProps = {
  activeIndex: number;
  canReorder: boolean;
  dragOverIndex: number | null;
  dragProps?: CatalogDragProps;
  dragState: CatalogDragState;
  isSelected: boolean;
  module: ChecklistModule;
  onEdit: (module: ChecklistModule) => void;
  onReorder: (sourceId: number, targetIndex: number) => void;
  onSelect: (module: ChecklistModule) => void;
  onToggleStatus: (module: ChecklistModule) => void;
  pendingModuleIds: Set<number>;
  questionCount: number;
};

export function CatalogModuleCard({
  activeIndex,
  canReorder,
  dragOverIndex,
  dragProps,
  dragState,
  isSelected,
  module,
  onEdit,
  onReorder,
  onSelect,
  onToggleStatus,
  pendingModuleIds,
  questionCount,
}: CatalogModuleCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(module);
      return;
    }

    if (!canReorder || !event.altKey) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onReorder(module.id, Math.max(0, activeIndex - 1));
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onReorder(module.id, activeIndex + 2);
    }
  };

  return (
    <div
      className={`checklist-order-item checklist-catalog-module-card module${
        isSelected ? " selected" : ""
      }${!module.isActive ? " inactive" : ""}${
        dragState?.kind === "module" && dragState.id === module.id
          ? " dragging"
          : ""
      }`}
      data-catalog-module-item={canReorder ? "true" : undefined}
      onClick={() => onSelect(module)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...(canReorder ? dragProps : undefined)}
    >
      {dragState?.kind === "module" && dragOverIndex === activeIndex ? (
        <span className="checklist-order-drop-line" />
      ) : null}
      {canReorder ? (
        <GripVertical aria-hidden="true" size={18} />
      ) : (
        <span aria-hidden="true" className="checklist-catalog-drag-spacer" />
      )}
      <div className="checklist-catalog-module-content">
        <strong>{module.name}</strong>
        <small>{formatQuestionCount(questionCount)}</small>
      </div>
      <span className="admin-table-actions">
        <button
          aria-label="Редактировать модуль"
          className="admin-icon-button"
          data-no-drag="true"
          onDoubleClick={stopCardEvent}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(module);
          }}
          onPointerDown={stopCardEvent}
          title="Редактировать"
          type="button"
        >
          <Pencil size={17} />
        </button>
        <button
          aria-label={
            module.isActive ? "Деактивировать модуль" : "Активировать модуль"
          }
          className={`admin-icon-button checklist-status-toggle${
            module.isActive ? " active" : " inactive"
          }`}
          data-no-drag="true"
          disabled={pendingModuleIds.has(module.id)}
          onDoubleClick={stopCardEvent}
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus(module);
          }}
          onPointerDown={stopCardEvent}
          title={module.isActive ? "Деактивировать" : "Активировать"}
          type="button"
        >
          <Power size={17} />
        </button>
      </span>
    </div>
  );
}
