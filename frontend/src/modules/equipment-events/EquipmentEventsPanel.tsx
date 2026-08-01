import type { EquipmentStatus } from "../../shared/api/equipment/equipment.types";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { EquipmentEventsPanelHeader } from "./EquipmentEventsPanelHeader";
import { EquipmentEventsPanelModals } from "./EquipmentEventsPanelModals";
import { EquipmentEventsPanelState } from "./EquipmentEventsPanelState";
import { useEquipmentEventsPanel } from "./useEquipmentEventsPanel";
import "./EquipmentEventsPanel.css";

type EquipmentEventsPanelProps = {
  canManageEvents: boolean;
  equipmentStatus: EquipmentStatus;
  initialEventId?: number | null;
  visibleId: number;
};

export function EquipmentEventsPanel({
  canManageEvents,
  equipmentStatus,
  initialEventId = null,
  visibleId,
}: EquipmentEventsPanelProps) {
  const panel = useEquipmentEventsPanel({
    canManageEvents,
    equipmentStatus,
    initialEventId,
    visibleId,
  });

  return (
    <section className="equipment-events-panel">
      {panel.listError ? <Notice tone="error">{panel.listError}</Notice> : null}
      {panel.topLevelActionError ? (
        <Notice tone="error">{panel.topLevelActionError}</Notice>
      ) : null}
      {panel.refreshError ? (
        <Notice tone="error">{panel.refreshError}</Notice>
      ) : null}
      <section className="admin-card equipment-events-card">
        <EquipmentEventsPanelHeader
          canManageEvents={canManageEvents}
          formDataError={panel.formDataError}
          isCreateDisabled={panel.isCreateDisabled}
          isFormDataLoading={panel.isFormDataLoading}
          onCreate={panel.openCreateForm}
          onReloadFormData={() => void panel.reloadFormData()}
          shouldShowWrittenOffState={panel.shouldShowWrittenOffState}
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
        detailError={panel.detailError}
        maintenanceSettings={panel.maintenanceSettings}
        modalState={panel.modalState}
        isDetailLoading={panel.isDetailLoading}
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
