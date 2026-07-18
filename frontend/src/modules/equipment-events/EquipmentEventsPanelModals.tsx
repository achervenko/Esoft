import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { EquipmentEventDetailModal } from "./EquipmentEventDetailModal";
import { EquipmentEventFormModal } from "./EquipmentEventFormModal";
import type {
  EquipmentEventFormPayload,
  ResponsibleUserOption,
} from "./equipment-event-form.types";
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
  onCloseDetail: () => void;
  onCloseForm: () => void;
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
  onCloseDetail,
  onCloseForm,
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
          event={modalState.detailEvent}
          onClose={onCloseDetail}
        />
      ) : null}
    </>
  );
}
