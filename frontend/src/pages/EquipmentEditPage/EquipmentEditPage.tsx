import { ArrowLeft } from "lucide-react";
import { EquipmentDocumentsPanel } from "../../modules/equipment-documents";
import { Notice } from "../../shared/ui/Notice";
import { UnsavedChangesGuard } from "../../shared/ui/UnsavedChangesGuard";
import { EquipmentCreateForm } from "../EquipmentCreatePage/EquipmentCreateForm";
import { EquipmentEditTabs } from "./EquipmentEditTabs";
import {
  getEquipmentEditPanelId,
  getEquipmentEditTabId,
} from "./equipment-edit-tab-ids";
import {
  buildEquipmentViewHref,
  type EquipmentEditTab,
} from "./equipment-edit-navigation";
import { useEquipmentEditPage } from "./useEquipmentEditPage";
import "../EquipmentCreatePage/EquipmentCreatePage.css";

type EquipmentEditPageProps = {
  initialTab?: EquipmentEditTab;
  returnTo: string;
  userRole: string | null;
  visibleId: number;
};

export function EquipmentEditPage({
  initialTab = "details",
  returnTo,
  userRole,
  visibleId,
}: EquipmentEditPageProps) {
  const page = useEquipmentEditPage({
    initialTab,
    returnTo,
    userRole,
    visibleId,
  });

  if (!page.isEditAllowed) {
    return (
      <div className="equipment-create-page">
        <BackToCardLink
          activeTab={page.activeTab}
          returnTo={returnTo}
          visibleId={visibleId}
        />
        <h1>Редактирование оборудования</h1>
        <Notice tone="error">
          У вашей роли нет доступа к редактированию оборудования.
        </Notice>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <UnsavedChangesGuard hasChanges={page.hasUnsavedChanges} />
      <BackToCardLink
        activeTab={page.activeTab}
        returnTo={returnTo}
        visibleId={visibleId}
      />

      <header className="equipment-create-header">
        <h1>Редактирование оборудования</h1>
      </header>

      {page.isLoading ? <Notice>Загрузка карточки оборудования...</Notice> : null}
      {page.error ? (
        <Notice floating tone="error">
          {page.error}
        </Notice>
      ) : null}

      <EquipmentEditTabs
        activeTab={page.activeTab}
        onTabChange={page.setActiveTab}
      />

      {page.options && page.initialForm && !page.isLoading ? (
        page.activeTab === "details" ? (
          <section
            aria-labelledby={getEquipmentEditTabId("details")}
            id={getEquipmentEditPanelId("details")}
            role="tabpanel"
          >
            <EquipmentCreateForm
              fieldErrors={page.fieldErrors}
              form={page.form}
              isSubmitting={page.isSubmitting}
              onChange={page.updateForm}
              onFieldFocus={page.handleFieldFocus}
              onSubmit={page.handleSubmit}
              options={page.options}
              submitLabel="Сохранить изменения"
              submittingLabel="Сохранение..."
            />
          </section>
        ) : (
          <section
            aria-labelledby={getEquipmentEditTabId("documents")}
            id={getEquipmentEditPanelId("documents")}
            role="tabpanel"
          >
            <EquipmentDocumentsPanel
              mode="edit"
              onSaved={page.handleDocumentsSaved}
              visibleId={visibleId}
            />
          </section>
        )
      ) : null}
    </div>
  );
}

function BackToCardLink({
  activeTab,
  returnTo,
  visibleId,
}: {
  activeTab: EquipmentEditTab;
  returnTo: string;
  visibleId: number;
}) {
  return (
    <a
      className="equipment-back-link"
      href={buildEquipmentViewHref(visibleId, activeTab, returnTo)}
    >
      <ArrowLeft aria-hidden="true" size={18} />
      <span>{"Назад"}</span>
    </a>
  );
}
