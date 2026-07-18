import { Plus } from "lucide-react";
import { Fragment, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ChecklistModule } from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import { CatalogModuleCard } from "./CatalogModuleCard";
import { CatalogUnassignedCard } from "./CatalogUnassignedCard";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";
import type { CatalogDragItem, CatalogDragState } from "./catalog-reorder.types";

type CatalogModulesColumnProps = {
  activeModules: ChecklistModule[];
  dragOverIndex: number | null;
  dragState: CatalogDragState;
  filteredModules: ChecklistModule[];
  getModuleDragProps: (item: CatalogDragItem) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  isModuleReorderDisabled: boolean;
  moduleListRef: RefObject<HTMLDivElement | null>;
  moduleSearch: string;
  normalizedModuleSearch: string;
  onCreateModule: () => void;
  onEditModule: (module: ChecklistModule) => void;
  onModuleSearchChange: (value: string) => void;
  onReorderModules: (sourceId: number, targetIndex: number) => void;
  onSelectGroup: (group: SelectedQuestionGroup) => void;
  onToggleModuleStatus: (module: ChecklistModule) => void;
  pendingModuleIds: Set<number>;
  questionCountByModuleId: Map<number, number>;
  selectedGroup: SelectedQuestionGroup;
  selectedModuleId: number | null;
  unassignedCount: number;
};

export function CatalogModulesColumn({
  activeModules,
  dragOverIndex,
  dragState,
  filteredModules,
  getModuleDragProps,
  isModuleReorderDisabled,
  moduleListRef,
  moduleSearch,
  normalizedModuleSearch,
  onCreateModule,
  onEditModule,
  onModuleSearchChange,
  onReorderModules,
  onSelectGroup,
  onToggleModuleStatus,
  pendingModuleIds,
  questionCountByModuleId,
  selectedGroup,
  selectedModuleId,
  unassignedCount,
}: CatalogModulesColumnProps) {
  return (
    <section className="checklist-order-column checklist-catalog-column">
      <header>
        <h2>Модули</h2>
        <button
          className="admin-primary-button"
          onClick={onCreateModule}
          type="button"
        >
          <Plus size={18} />
          Добавить модуль
        </button>
      </header>

      <div className="checklist-admin-filters">
        <input
          aria-label="Поиск по модулям"
          className="checklist-catalog-search-input"
          onChange={(event) => onModuleSearchChange(event.target.value)}
          placeholder="Поиск по модулям"
          value={moduleSearch}
        />
      </div>

      <div className="checklist-order-list" ref={moduleListRef}>
        <CatalogUnassignedCard
          isSelected={selectedGroup.kind === "unassigned"}
          onSelect={() => onSelectGroup({ kind: "unassigned" })}
          questionCount={unassignedCount}
        />

        {isModuleReorderDisabled ? (
          <p className="admin-state">Очистите поиск, чтобы изменить порядок.</p>
        ) : null}

        {filteredModules.length === 0 ? (
          <p className="admin-state">
            {normalizedModuleSearch
              ? "Модули не найдены."
              : "Модули пока не созданы."}
          </p>
        ) : null}

        {filteredModules.map((module) => {
          const canReorder = module.isActive && !isModuleReorderDisabled;
          const activeIndex = activeModules.findIndex(
            (activeModule) => activeModule.id === module.id,
          );
          const questionCount = questionCountByModuleId.get(module.id) ?? 0;

          return (
            <Fragment key={module.id}>
              <CatalogModuleCard
                activeIndex={activeIndex}
                canReorder={canReorder}
                dragOverIndex={dragOverIndex}
                dragProps={getModuleDragProps({
                  id: module.id,
                  kind: "module",
                  subtitle: formatQuestionCount(questionCount),
                  title: module.name,
                })}
                dragState={dragState}
                isSelected={selectedModuleId === module.id}
                module={module}
                onEdit={onEditModule}
                onReorder={onReorderModules}
                onSelect={(selectedModule) =>
                  onSelectGroup({ kind: "module", moduleId: selectedModule.id })
                }
                onToggleStatus={onToggleModuleStatus}
                pendingModuleIds={pendingModuleIds}
                questionCount={questionCount}
              />
              {dragState?.kind === "module" &&
              dragOverIndex === activeModules.length &&
              activeIndex === activeModules.length - 1 ? (
                <span className="checklist-order-drop-line after" />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
