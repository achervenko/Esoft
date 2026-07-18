import { useMemo, useState } from "react";
import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import { CatalogDragOverlay } from "./CatalogDragOverlay";
import { CatalogModulesColumn } from "./CatalogModulesColumn";
import { CatalogQuestionsColumn } from "./CatalogQuestionsColumn";
import {
  filterCatalogModules,
  getCatalogQuestionsTitle,
  getNormalizedCatalogSearch,
} from "./catalog-panel.utils";
import { useCatalogReorderDrag } from "./useCatalogReorderDrag";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";

type CatalogPanelProps = {
  groupQuestions: ChecklistQuestion[];
  isLoading: boolean;
  isSavingModules: boolean;
  isSavingQuestions: boolean;
  modules: ChecklistModule[];
  onCreateModule: () => void;
  onCreateQuestion: (moduleId: number | null) => void;
  onEditModule: (module: ChecklistModule) => void;
  onEditQuestion: (question: ChecklistQuestion) => void;
  onReorderModules: (sourceId: number, targetIndex: number) => void;
  onReorderQuestions: (sourceId: number, targetIndex: number) => void;
  onToggleModuleStatus: (module: ChecklistModule) => void;
  onToggleQuestionStatus: (question: ChecklistQuestion) => void;
  pendingModuleIds: Set<number>;
  pendingQuestionIds: Set<number>;
  questionCountByModuleId: Map<number, number>;
  questionSearch: string;
  selectedGroup: SelectedQuestionGroup;
  selectedModule: ChecklistModule | null;
  setQuestionSearch: (value: string) => void;
  setSelectedGroup: (group: SelectedQuestionGroup) => void;
  unassignedCount: number;
};

export function CatalogPanel({
  groupQuestions,
  isLoading,
  isSavingModules,
  isSavingQuestions,
  modules,
  onCreateModule,
  onCreateQuestion,
  onEditModule,
  onEditQuestion,
  onReorderModules,
  onReorderQuestions,
  onToggleModuleStatus,
  onToggleQuestionStatus,
  pendingModuleIds,
  pendingQuestionIds,
  questionCountByModuleId,
  questionSearch,
  selectedGroup,
  selectedModule,
  setQuestionSearch,
  setSelectedGroup,
  unassignedCount,
}: CatalogPanelProps) {
  const [moduleSearch, setModuleSearch] = useState("");
  const normalizedModuleSearch = getNormalizedCatalogSearch(moduleSearch);
  const isModuleReorderDisabled = Boolean(normalizedModuleSearch);
  const isQuestionReorderDisabled =
    selectedGroup.kind === "unassigned" || Boolean(questionSearch.trim());
  const selectedModuleId =
    selectedGroup.kind === "module" ? selectedGroup.moduleId : null;
  const isSelectedModuleActive =
    selectedGroup.kind === "module" ? Boolean(selectedModule?.isActive) : true;
  const activeModules = useMemo(
    () => modules.filter((module) => module.isActive),
    [modules],
  );
  const activeQuestionIds = useMemo(
    () =>
      groupQuestions
        .filter((question) => question.isActive && selectedGroup.kind === "module")
        .map((question) => question.id),
    [groupQuestions, selectedGroup.kind],
  );
  const filteredModules = useMemo(
    () => filterCatalogModules(modules, normalizedModuleSearch),
    [modules, normalizedModuleSearch],
  );
  const drag = useCatalogReorderDrag({
    isModuleReorderDisabled,
    isQuestionReorderDisabled,
    isSavingModules,
    isSavingQuestions,
    onReorderModules,
    onReorderQuestions,
  });

  if (isLoading) {
    return <p className="admin-state">Загрузка...</p>;
  }

  return (
    <div className="checklist-catalog-panel">
      <CatalogModulesColumn
        activeModules={activeModules}
        dragOverIndex={drag.dragOverIndex}
        dragState={drag.dragState}
        filteredModules={filteredModules}
        getModuleDragProps={drag.getModuleDragProps}
        isModuleReorderDisabled={isModuleReorderDisabled}
        moduleListRef={drag.moduleListRef}
        moduleSearch={moduleSearch}
        normalizedModuleSearch={normalizedModuleSearch}
        onCreateModule={onCreateModule}
        onEditModule={onEditModule}
        onModuleSearchChange={setModuleSearch}
        onReorderModules={onReorderModules}
        onSelectGroup={setSelectedGroup}
        onToggleModuleStatus={onToggleModuleStatus}
        pendingModuleIds={pendingModuleIds}
        questionCountByModuleId={questionCountByModuleId}
        selectedGroup={selectedGroup}
        selectedModuleId={selectedModuleId}
        unassignedCount={unassignedCount}
      />

      <CatalogQuestionsColumn
        activeQuestionIds={activeQuestionIds}
        dragOverIndex={drag.dragOverIndex}
        dragState={drag.dragState}
        getQuestionDragProps={drag.getQuestionDragProps}
        groupQuestions={groupQuestions}
        isSelectedModuleActive={isSelectedModuleActive}
        isSavingQuestions={isSavingQuestions}
        onCreateQuestion={onCreateQuestion}
        onEditQuestion={onEditQuestion}
        onQuestionSearchChange={setQuestionSearch}
        onReorderQuestions={onReorderQuestions}
        onToggleQuestionStatus={onToggleQuestionStatus}
        pendingQuestionIds={pendingQuestionIds}
        questionListRef={drag.questionListRef}
        questionSearch={questionSearch}
        selectedGroup={selectedGroup}
        selectedModuleId={selectedModuleId}
        title={getCatalogQuestionsTitle(selectedGroup, selectedModule?.name ?? null)}
      />

      <CatalogDragOverlay
        dragState={drag.dragState}
        setOverlayRef={drag.setOverlayRef}
      />
    </div>
  );
}
