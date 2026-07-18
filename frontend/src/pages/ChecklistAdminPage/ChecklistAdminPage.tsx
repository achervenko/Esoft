import { useEffect, useMemo, useState } from "react";
import { getHashRouteParam } from "../../shared/lib/hash-navigation";
import { canManageChecklists } from "../../shared/lib/roles";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { ChecklistAdminModals } from "./ChecklistAdminModals";
import "./ChecklistAdminPage.css";
import { ChecklistAdminPanels } from "./ChecklistAdminPanels";
import { checklistAdminTabLabels } from "./checklist-admin.constants";
import type {
  ActiveChecklistAdminTab,
  ChecklistAdminConfirmState,
  ChecklistAdminFormState,
} from "./checklist-admin.types";
import { useChecklistAdminActions } from "./useChecklistAdminActions";
import { useChecklistCatalog } from "./useChecklistCatalog";
import { useChecklistTemplates } from "./useChecklistTemplates";

type ChecklistAdminPageProps = {
  userRole: string | null;
};

export function ChecklistAdminPage({ userRole }: ChecklistAdminPageProps) {
  const canManage = canManageChecklists(userRole);
  const [activeTab, setActiveTab] = useState<ActiveChecklistAdminTab>(
    getInitialTab(),
  );
  const [form, setForm] = useState<ChecklistAdminFormState>(null);
  const [confirm, setConfirm] = useState<ChecklistAdminConfirmState>(null);

  const templatesState = useChecklistTemplates({
    enabled: canManage && activeTab === "templates",
  });
  const catalogState = useChecklistCatalog({
    enabled: canManage && activeTab === "catalog",
  });

  const actions = useChecklistAdminActions({
    activeTab,
    catalogState,
    reloadCatalog: catalogState.reload,
    reloadTemplates: templatesState.reload,
  });

  const pageError = useMemo(
    () =>
      actions.actionError ??
      (activeTab === "templates"
        ? templatesState.error
        : catalogState.error),
    [
      actions.actionError,
      activeTab,
      catalogState.error,
      templatesState.error,
    ],
  );

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getInitialTab());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (!canManage) {
    return (
      <section className="admin-page checklist-admin-page">
        <header className="admin-page-header">
          <h1>Чек-листы</h1>
        </header>

        <section className="admin-card">
          <h2>Рабочие чек-листы</h2>
          <p className="admin-state">
            Рабочая страница чек-листов пока не реализована.
          </p>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-page checklist-admin-page">
      <header className="admin-page-header">
        <h1>Чек-листы</h1>
      </header>

      <div className="equipment-edit-tabs admin-tabs" role="tablist">
        {Object.entries(checklistAdminTabLabels).map(([tab, label]) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : undefined}
            key={tab}
            onClick={() => {
              actions.clearFeedback();
              const nextTab = tab as ActiveChecklistAdminTab;
              setActiveTab(nextTab);
              window.location.hash =
                nextTab === "templates"
                  ? "#/checklist-admin"
                  : `#/checklist-admin?tab=${nextTab}`;
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {pageError ? <Notice tone="error">{pageError}</Notice> : null}
      {actions.message ? (
        <Notice tone="success">{actions.message}</Notice>
      ) : null}

      <section className="admin-card">
        <ChecklistAdminPanels
          activeTab={activeTab}
          catalogState={catalogState}
          onActivateModule={(module) => void actions.activateModule(module)}
          onActivateQuestion={(question) => void actions.activateQuestion(question)}
          setConfirm={setConfirm}
          setForm={setForm}
          templatesState={templatesState}
        />
      </section>

      <ChecklistAdminModals
        actions={actions}
        catalogState={catalogState}
        confirm={confirm}
        form={form}
        setConfirm={setConfirm}
        setForm={setForm}
      />
    </section>
  );
}

function getInitialTab(): ActiveChecklistAdminTab {
  const tab = getHashRouteParam(window.location.hash, "tab");

  if (
    tab === "templates" ||
    tab === "catalog"
  ) {
    return tab;
  }

  if (tab === "questions" || tab === "modules" || tab === "order") {
    return "catalog";
  }

  return "templates";
}
