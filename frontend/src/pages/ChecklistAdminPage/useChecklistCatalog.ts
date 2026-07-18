import { useChecklistCatalogLoader } from "./useChecklistCatalogLoader";
import { useChecklistCatalogMutations } from "./useChecklistCatalogMutations";
import { useChecklistCatalogReorder } from "./useChecklistCatalogReorder";
import { useChecklistCatalogSelection } from "./useChecklistCatalogSelection";
import { useChecklistCatalogState } from "./checklist-catalog.state";

export type { SelectedQuestionGroup } from "./checklist-catalog.types";

export function useChecklistCatalog({ enabled }: { enabled: boolean }) {
  const state = useChecklistCatalogState();
  const selection = useChecklistCatalogSelection({
    modules: state.modules,
    questionSearch: state.questionSearch,
    questions: state.questions,
    selectedGroup: state.selectedGroup,
  });
  const loader = useChecklistCatalogLoader({ enabled, state });
  const mutations = useChecklistCatalogMutations({ state });
  const reorder = useChecklistCatalogReorder({ selection, state });

  return {
    activeModules: selection.activeModules,
    error: state.error,
    groupQuestions: selection.groupQuestions,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    isSavingModules: reorder.isSavingModules,
    isSavingQuestions: reorder.isSavingQuestions,
    modules: state.modules,
    pendingModuleIds: state.pendingModuleIds,
    pendingQuestionIds: state.pendingQuestionIds,
    questionCountByModuleId: selection.questionCountByModuleId,
    questionSearch: state.questionSearch,
    selectedGroup: state.selectedGroup,
    selectedModule: selection.selectedModule,
    unassignedCount: selection.unassignedCount,
    reload: loader.reload,
    reorderModules: reorder.reorderModules,
    reorderQuestions: reorder.reorderQuestions,
    saveModule: mutations.saveModule,
    saveQuestion: mutations.saveQuestion,
    selectCreatedModule: mutations.selectCreatedModule,
    setModuleStatus: mutations.setModuleStatus,
    setQuestionSearch: state.setQuestionSearch,
    setQuestionStatus: mutations.setQuestionStatus,
    setSelectedGroup: state.setSelectedGroup,
  };
}
