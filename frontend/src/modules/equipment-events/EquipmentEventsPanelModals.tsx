import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { CompleteEquipmentEventModal } from "./CompleteEquipmentEventModal";
import { EquipmentEventDetailModal } from "./EquipmentEventDetailModal";
import {
  EquipmentEventFormModal,
  type EquipmentEventFormPayload,
} from "./EquipmentEventFormModal";
import type { ResponsibleUserOption } from "./equipment-event-form.types";
import type { EquipmentEventAction } from "./useEquipmentEventActions";
import type { EquipmentEventsPanelModalState } from "./equipment-events-panel.types";

type EquipmentEventsPanelModalsProps = {
  actionError: string | null;
  activeAction: EquipmentEventAction;
  checklistTemplates: ChecklistTemplateListItem[];
  maintenanceSettings: MaintenanceSetting[];
  modalState: EquipmentEventsPanelModalState;
  onCancel: () => Promise<void>;
  onCloseCancel: () => void;
  onCloseComplete: () => void;
  onCloseDetail: () => void;
  onCloseForm: () => void;
  onComplete: (factDate: string) => Promise<void>;
  onFormSubmit: (payload: EquipmentEventFormPayload) => Promise<void>;
  responsibleUsers: ResponsibleUserOption[];
};

export function EquipmentEventsPanelModals({
  actionError,
  activeAction,
  checklistTemplates,
  maintenanceSettings,
  modalState,
  onCancel,
  onCloseCancel,
  onCloseComplete,
  onCloseDetail,
  onCloseForm,
  onComplete,
  onFormSubmit,
  responsibleUsers,
}: EquipmentEventsPanelModalsProps) {
  return (
    <>
      {modalState.activeForm ? (
        <EquipmentEventFormModal
          checklistTemplates={checklistTemplates}
          error={actionError}
          users={responsibleUsers}
          event={modalState.activeForm.event ?? null}
          isSaving={activeAction === "create" || activeAction === "edit"}
          maintenanceSettings={maintenanceSettings}
          mode={modalState.activeForm.mode}
          onClose={onCloseForm}
          onSubmit={(payload) => void onFormSubmit(payload)}
        />
      ) : null}

      {modalState.completeCandidate ? (
        <CompleteEquipmentEventModal
          error={actionError}
          event={modalState.completeCandidate}
          isSaving={activeAction === "complete"}
          onClose={onCloseComplete}
          onSubmit={(factDate) => void onComplete(factDate)}
        />
      ) : null}

      {modalState.cancelCandidate ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Отменить"
          description={`Событие «${modalState.cancelCandidate.maintenanceType.name}» будет отменено.`}
          error={actionError}
          isLoading={activeAction === "cancel"}
          loadingLabel="Отмена..."
          onCancel={onCloseCancel}
          onConfirm={() => void onCancel()}
          title="Отменить событие?"
          variant="danger"
        />
      ) : null}

      {modalState.detailEvent ? (
        <EquipmentEventDetailModal
          checklistTemplates={checklistTemplates}
          event={modalState.detailEvent}
          onClose={onCloseDetail}
        />
      ) : null}
    </>
  );
}
