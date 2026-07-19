import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { MyChecklistDetail } from "./components/MyChecklistDetail";
import type { ChecklistTabKey } from "./my-checklists.config";
import { useChecklistWork } from "./hooks/use-checklist-work";
import { getChecklistTabForStatus } from "./my-checklists.utils";
import "./MyChecklistViewPage.css";

export type MyChecklistViewPageProps = {
  fallbackTab: ChecklistTabKey;
  checklistId: number;
  currentUserId?: string | null;
};

export function MyChecklistViewPage({
  fallbackTab,
  checklistId,
  currentUserId = null,
}: MyChecklistViewPageProps) {
  const checklistWork = useChecklistWork({
    checklistId,
    currentUserId,
  });

  const backTab: ChecklistTabKey = checklistWork.checklist
    ? getChecklistTabForStatus(checklistWork.checklist.status)
    : fallbackTab;

  const backHref = buildHashRoute("#/my-checklists", {
    tab: backTab === "new" ? null : backTab,
  });

  useEffect(() => {
    if (checklistWork.checklist?.status === "CREATED") {
      window.history.replaceState(null, "", "#/my-checklists");
    }
  }, [checklistWork.checklist?.status]);

  const handleReload = () => {
    if (
      checklistWork.hasUnsavedChanges &&
      !window.confirm(
        "Перезагрузить чек-лист? Несохранённые ответы будут потеряны.",
      )
    ) {
      return;
    }

    void checklistWork.reloadChecklist();
  };

  return (
    <div className="admin-page my-checklist-view-page">
      <header className="admin-page-header my-checklists-view-header">
        <a className="my-checklists-back-link" href={backHref}>
          <ChevronLeft aria-hidden="true" size={18} />
          <span>Назад</span>
        </a>
      </header>

      {checklistWork.message ? (
        <Notice tone="success">{checklistWork.message}</Notice>
      ) : null}
      {checklistWork.detailError ? (
        <Notice tone="error">{checklistWork.detailError}</Notice>
      ) : null}
      {checklistWork.refreshError ? (
        <Notice tone="info">{checklistWork.refreshError}</Notice>
      ) : null}
      {checklistWork.versionConflict ? (
        <Notice tone="error">{checklistWork.versionConflict}</Notice>
      ) : null}

      <MyChecklistDetail
        canMutateSelected={checklistWork.canMutateSelected}
        checklist={checklistWork.checklist}
        draftAnswers={checklistWork.draftAnswers}
        emptyMessage="Чек-лист не найден или недоступен."
        formError={checklistWork.formError}
        isActionLoading={checklistWork.isActionLoading}
        isDetailLoading={checklistWork.isDetailLoading}
        onAnswerChange={checklistWork.setAnswerValue}
        onComplete={() => void checklistWork.completeChecklist()}
        onReload={handleReload}
        onSave={() => void checklistWork.saveChecklist()}
        showRequiredErrors={checklistWork.showRequiredErrors}
        versionConflict={checklistWork.versionConflict}
      />
    </div>
  );
}
