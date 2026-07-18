import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type { MaintenanceType } from "../../shared/api/maintenance/maintenance.types";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { MaintenanceSettingFormModal } from "./MaintenanceSettingFormModal";
import type { MaintenanceSettingFormPayload } from "./maintenance-setting-form.types";
import type { MaintenanceSettingsPanelModalState } from "./maintenance-settings-panel.types";

type MaintenanceSettingsPanelModalsProps = {
  availableMaintenanceTypes: MaintenanceType[];
  checklistTemplates: ChecklistTemplateListItem[];
  deleteError: string | null;
  formErrorCode: string | null;
  isDeleting: boolean;
  isSaving: boolean;
  modalState: MaintenanceSettingsPanelModalState;
  onCloseDelete: () => void;
  onCloseForm: () => void;
  onConfirmDelete: () => Promise<void>;
  onFormSubmit: (payload: MaintenanceSettingFormPayload) => Promise<void>;
};

export function MaintenanceSettingsPanelModals({
  availableMaintenanceTypes,
  checklistTemplates,
  deleteError,
  formErrorCode,
  isDeleting,
  isSaving,
  modalState,
  onCloseDelete,
  onCloseForm,
  onConfirmDelete,
  onFormSubmit,
}: MaintenanceSettingsPanelModalsProps) {
  return (
    <>
      {modalState.activeForm ? (
        <MaintenanceSettingFormModal
          availableMaintenanceTypes={availableMaintenanceTypes}
          checklistTemplates={checklistTemplates}
          isSaving={isSaving}
          mode={modalState.activeForm.mode}
          onClose={onCloseForm}
          onSubmit={(payload) => void onFormSubmit(payload)}
          serverErrorCode={formErrorCode}
          setting={modalState.activeForm.setting ?? null}
        />
      ) : null}

      {modalState.deleteCandidate ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Удалить"
          description={
            <>
              Настройка «{modalState.deleteCandidate.maintenanceType.name}»
              будет удалена для всей модели оборудования. Уже созданные события
              не изменятся.
            </>
          }
          error={deleteError}
          isLoading={isDeleting}
          loadingLabel="Удаление..."
          onCancel={onCloseDelete}
          onConfirm={() => void onConfirmDelete()}
          title="Удалить настройку обслуживания?"
          variant="danger"
        />
      ) : null}
    </>
  );
}
