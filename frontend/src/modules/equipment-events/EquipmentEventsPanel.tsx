import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { EquipmentEventsPanelHeader } from "./EquipmentEventsPanelHeader";
import { EquipmentEventsPanelModals } from "./EquipmentEventsPanelModals";
import { EquipmentEventsPanelState } from "./EquipmentEventsPanelState";
import { useEquipmentEventsPanel } from "./useEquipmentEventsPanel";
import "./EquipmentEventsPanel.css";

type EquipmentEventsPanelProps = {
  canManageEvents: boolean;
  visibleId: number;
};

export function EquipmentEventsPanel({
  canManageEvents,
  visibleId,
}: EquipmentEventsPanelProps) {
  const panel = useEquipmentEventsPanel({ canManageEvents, visibleId });

  return (
    <section className="equipment-events-panel">
      {panel.listError ? <Notice tone="error">{panel.listError}</Notice> : null}
      {panel.topLevelActionError ? (
        <Notice tone="error">{panel.topLevelActionError}</Notice>
      ) : null}
      {panel.refreshError ? (
        <Notice tone="error">{panel.refreshError}</Notice>
      ) : null}
      {panel.message ? <Notice tone="success">{panel.message}</Notice> : null}
      {panel.isDetailLoading ? (
        <Notice tone="info">Загрузка события...</Notice>
      ) : null}

      <section className="admin-card equipment-events-card">
        <EquipmentEventsPanelHeader
          canManageEvents={canManageEvents}
          formDataError={panel.formDataError}
          isCreateDisabled={panel.isCreateDisabled}
          isFormDataLoading={panel.isFormDataLoading}
          onCreate={panel.openCreateForm}
          onReloadFormData={() => void panel.reloadFormData()}
          shouldShowMissingSettings={panel.shouldShowMissingSettings}
        />

        <EquipmentEventsPanelState
          canEditEvents={panel.canEditEvents}
          canManageEvents={canManageEvents}
          events={panel.events}
          isLoading={panel.isLoading}
          onCancel={panel.requestCancel}
          onEdit={panel.handleEdit}
          onOpen={(event) => void panel.handleOpenDetail(event)}
        />
      </section>

      <EquipmentEventsPanelModals
        actionError={panel.actionError}
        activeAction={panel.activeAction}
        checklistTemplates={panel.checklistTemplates}
        maintenanceSettings={panel.maintenanceSettings}
        modalState={panel.modalState}
        onCancel={panel.handleCancel}
        onCloseCancel={panel.closeCancel}
        onCloseDetail={panel.closeDetail}
        onCloseForm={panel.closeForm}
        onFormSubmit={panel.handleFormSubmit}
        responsibleUsers={panel.responsibleUsers}
      />
    </section>
  );
}
