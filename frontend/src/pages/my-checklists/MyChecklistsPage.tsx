import { useCallback, useMemo, useState } from "react";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { MyChecklistDetail } from "./components/MyChecklistDetail";
import { MyChecklistsList } from "./components/MyChecklistsList";
import { MyChecklistsTabs } from "./components/MyChecklistsTabs";
import { useChecklistWork } from "./hooks/use-checklist-work";
import { useMyChecklistsList } from "./hooks/use-my-checklists-list";
import { getActiveTab } from "./my-checklists.utils";
import "./MyChecklistsPage.css";

export type MyChecklistsPageProps = {
  currentUserId?: string | null;
  route: string;
};

export function MyChecklistsPage({
  currentUserId = null,
  route,
}: MyChecklistsPageProps) {
  const activeTab = useMemo(() => getActiveTab(route), [route]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(
    null,
  );
  const handleSelectedChecklistMissing = useCallback(() => {
    setSelectedChecklistId(null);
  }, []);

  const handleChecklistStarted = useCallback(() => {
    const nextRoute = buildHashRoute("#/my-checklists", { tab: "in-progress" });

    if (window.location.hash !== nextRoute) {
      window.location.hash = nextRoute;
    }
  }, []);

  const checklistList = useMyChecklistsList({
    activeTab,
    onSelectedChecklistMissing: handleSelectedChecklistMissing,
    selectedChecklistId,
  });

  const checklistWork = useChecklistWork({
    currentUserId,
    onChecklistStarted: handleChecklistStarted,
    onSelectChecklistId: setSelectedChecklistId,
    reloadItems: checklistList.reload,
    selectedChecklistId,
  });

  return (
    <div className="admin-page my-checklists-page">
      <header className="admin-page-header">
        <div>
          <h1>Мои чек-листы</h1>
        </div>
      </header>

      {checklistList.error ? <Notice tone="error">{checklistList.error}</Notice> : null}
      {checklistWork.message ? <Notice tone="success">{checklistWork.message}</Notice> : null}
      {checklistWork.detailError ? <Notice tone="error">{checklistWork.detailError}</Notice> : null}
      {checklistWork.refreshError ? <Notice tone="info">{checklistWork.refreshError}</Notice> : null}
      {checklistWork.versionConflict ? (
        <Notice tone="error">{checklistWork.versionConflict}</Notice>
      ) : null}

      <section className="admin-card my-checklists-list">
        <MyChecklistsTabs activeTab={activeTab} />

        <div className="my-checklists-layout">
          <MyChecklistsList
            currentUserId={currentUserId}
            isLoading={checklistList.isLoading}
            items={checklistList.items}
            onOpen={(checklistId) => void checklistWork.openChecklist(checklistId)}
            onStart={(item) => void checklistWork.startFromListItem(item)}
          />

          <MyChecklistDetail
            canMutateSelected={checklistWork.canMutateSelected}
            checklist={checklistWork.selectedChecklist}
            draftAnswers={checklistWork.draftAnswers}
            formError={checklistWork.formError}
            isActionLoading={checklistWork.isActionLoading}
            isDetailLoading={checklistWork.isDetailLoading}
            onAnswerChange={checklistWork.setAnswerValue}
            onComplete={() => void checklistWork.completeChecklist()}
            onReload={() => void checklistWork.reloadSelectedChecklist()}
            onSave={() => void checklistWork.saveChecklist()}
            onStart={() => void checklistWork.startSelectedChecklist()}
            versionConflict={checklistWork.versionConflict}
          />
        </div>
      </section>
    </div>
  );
}
