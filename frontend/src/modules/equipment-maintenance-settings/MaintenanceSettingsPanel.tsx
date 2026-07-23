import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { MaintenanceSettingsPanelHeader } from "./MaintenanceSettingsPanelHeader";
import { MaintenanceSettingsPanelModals } from "./MaintenanceSettingsPanelModals";
import { MaintenanceSettingsPanelState } from "./MaintenanceSettingsPanelState";
import type { MaintenanceSettingsPanelProps } from "./maintenance-settings-panel.types";
import { useMaintenanceSettingsPanel } from "./useMaintenanceSettingsPanel";
import "./MaintenanceSettingsPanel.css";

export function MaintenanceSettingsPanel({
  canManage,
  visibleId,
}: MaintenanceSettingsPanelProps) {
  return (
    <MaintenanceSettingsPanelContent
      canManage={canManage}
      key={visibleId}
      visibleId={visibleId}
    />
  );
}

function MaintenanceSettingsPanelContent({
  canManage,
  visibleId,
}: MaintenanceSettingsPanelProps) {
  const panel = useMaintenanceSettingsPanel({ canManage, visibleId });

  return (
    <section className="maintenance-settings-panel">
      {panel.dataError ? (
        <Notice tone="error">{panel.dataError}</Notice>
      ) : null}
      {panel.clientError ? (
        <Notice tone="error">{panel.clientError}</Notice>
      ) : null}
      <section className="admin-card maintenance-settings-card">
        <MaintenanceSettingsPanelHeader
          availableTypesError={panel.availableTypesError}
          canManage={canManage}
          checklistTemplatesError={panel.checklistTemplatesError}
          isAvailableTypesLoading={panel.isAvailableTypesLoading}
          isChecklistTemplatesLoading={panel.isChecklistTemplatesLoading}
          isCreateDisabled={panel.isCreateDisabled}
          onCreate={panel.openCreateForm}
          onReloadAvailableTypes={() =>
            void panel.reloadAvailableMaintenanceTypes()
          }
          onReloadChecklistTemplates={() => void panel.reloadChecklistTemplates()}
        />

        <MaintenanceSettingsPanelState
          canManage={canManage}
          isLoading={panel.isLoading}
          onDelete={panel.requestDelete}
          onEdit={panel.openEditForm}
          settings={panel.settings}
        />
      </section>

      <MaintenanceSettingsPanelModals
        availableMaintenanceTypes={panel.availableMaintenanceTypes}
        checklistTemplates={panel.checklistTemplates}
        deleteError={panel.deleteError}
        formErrorCode={panel.formErrorCode}
        formErrorMessage={panel.formErrorMessage}
        isDeleting={panel.isDeleting}
        isSaving={panel.isSaving}
        modalState={panel.modalState}
        onCloseDelete={panel.closeDeleteDialog}
        onCloseForm={panel.closeForm}
        onConfirmDelete={panel.confirmDelete}
        onFormSubmit={panel.handleSubmit}
      />
    </section>
  );
}
