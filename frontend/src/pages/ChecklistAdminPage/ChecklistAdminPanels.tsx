import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import { CatalogPanel } from "./CatalogPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import type {
  ActiveChecklistAdminTab,
  ChecklistAdminConfirmState,
  ChecklistAdminFormState,
} from "./checklist-admin.types";
import type { useChecklistCatalog } from "./useChecklistCatalog";
import type { useChecklistTemplates } from "./useChecklistTemplates";

type ChecklistAdminPanelsProps = {
  activeTab: ActiveChecklistAdminTab;
  catalogState: ReturnType<typeof useChecklistCatalog>;
  onActivateModule: (module: ChecklistModule) => void;
  onActivateQuestion: (question: ChecklistQuestion) => void;
  setConfirm: (confirm: ChecklistAdminConfirmState) => void;
  setForm: (form: ChecklistAdminFormState) => void;
  templatesState: ReturnType<typeof useChecklistTemplates>;
};

export function ChecklistAdminPanels({
  activeTab,
  catalogState,
  onActivateModule,
  onActivateQuestion,
  setConfirm,
  setForm,
  templatesState,
}: ChecklistAdminPanelsProps) {
  if (activeTab === "templates") {
    return (
      <TemplatesPanel
        isLoading={templatesState.isLoading}
        onArchive={(template) => setConfirm({ kind: "archive-template", template })}
        onCopy={(template) => {
          window.location.hash = `#/checklist-admin/templates/new?copyFrom=${template.id}`;
        }}
        onCreate={() => {
          window.location.hash = "#/checklist-admin/templates/new";
        }}
        onSearch={templatesState.applyFilters}
        search={templatesState.search}
        setSearch={templatesState.setSearch}
        setState={templatesState.setState}
        state={templatesState.state}
        templates={templatesState.templates}
      />
    );
  }

  return (
    <CatalogPanel
      groupQuestions={catalogState.groupQuestions}
      isLoading={catalogState.isLoading}
      isSavingModules={catalogState.isSavingModules}
      isSavingQuestions={catalogState.isSavingQuestions}
      modules={catalogState.modules}
      onCreateModule={() => setForm({ kind: "module", item: null })}
      onCreateQuestion={(moduleId) =>
        setForm({ defaultModuleId: moduleId, kind: "question", item: null })
      }
      onEditModule={(item) => setForm({ kind: "module", item })}
      onEditQuestion={(item) =>
        setForm({
          defaultModuleId: item.checklistModuleId,
          kind: "question",
          item,
        })
      }
      onReorderModules={catalogState.reorderModules}
      onReorderQuestions={catalogState.reorderQuestions}
      onToggleModuleStatus={(module) => {
        if (module.isActive) {
          setConfirm({ kind: "module-status", module });
          return;
        }

        onActivateModule(module);
      }}
      onToggleQuestionStatus={(question) => {
        if (question.isActive) {
          setConfirm({ kind: "question-status", question });
          return;
        }

        onActivateQuestion(question);
      }}
      pendingModuleIds={catalogState.pendingModuleIds}
      pendingQuestionIds={catalogState.pendingQuestionIds}
      questionCountByModuleId={catalogState.questionCountByModuleId}
      questionSearch={catalogState.questionSearch}
      selectedGroup={catalogState.selectedGroup}
      selectedModule={catalogState.selectedModule}
      setQuestionSearch={catalogState.setQuestionSearch}
      setSelectedGroup={catalogState.setSelectedGroup}
      unassignedCount={catalogState.unassignedCount}
    />
  );
}
