import { Plus } from "lucide-react";
import { useState } from "react";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import "../../shared/ui/AdminPage.css";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Notice } from "../../shared/ui/Notice";
import { MaintenanceSettingFormModal } from "./MaintenanceSettingFormModal";
import type { MaintenanceSettingFormPayload } from "./MaintenanceSettingFormModal";
import { MaintenanceSettingsTable } from "./MaintenanceSettingsTable";
import { buildMaintenanceSettingUpdatePayload } from "./maintenance-setting-form-utils";
import { useMaintenanceSettingActions } from "./useMaintenanceSettingActions";
import { useMaintenanceSettingsData } from "./useMaintenanceSettingsData";
import "./MaintenanceSettingsPanel.css";

type MaintenanceSettingsPanelProps = {
  canManage: boolean;
  visibleId: number;
};

type ActiveForm =
  | { mode: "create"; setting?: null }
  | { mode: "edit"; setting: MaintenanceSetting };

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
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<MaintenanceSetting | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    applySettingsResponse,
    availableMaintenanceTypes,
    availableTypesError,
    clearDataError,
    error,
    isAvailableTypesLoading,
    isLoading,
    reloadAvailableMaintenanceTypes,
    reloadMaintenanceSettings,
    settingsResponse,
  } = useMaintenanceSettingsData({ canManage, visibleId });
  const {
    clearDeleteError,
    clearFormError,
    createSetting,
    deleteError,
    deleteSetting,
    formErrorCode,
    isDeleting,
    isSaving,
    updateSetting,
  } = useMaintenanceSettingActions({
    canManage,
    applySettingsResponse,
    reloadAvailableMaintenanceTypes,
    reloadMaintenanceSettings,
    settingsResponse,
    visibleId,
  });

  const openForm = (form: ActiveForm) => {
    clearFormError();
    setActiveForm(form);
  };

  const handleSubmit = async (payload: MaintenanceSettingFormPayload) => {
    if (!activeForm) {
      return;
    }

    if (activeForm.mode === "create" && payload.maintenanceTypeId) {
      const maintenanceTypeId = payload.maintenanceTypeId;

      clearDataError();
      setMessage(null);

      const result = await createSetting({
        checklistTemplateId: payload.checklistTemplateId,
        maintenanceTypeId,
        executionType: payload.executionType,
        periodicity: payload.periodicity,
      });

      if (result.success) {
        setActiveForm(null);
        setMessage(result.message);
      }

      return;
    }

    if (activeForm.mode === "edit") {
      const updatePayload =
        payload.updatePayload ??
        buildMaintenanceSettingUpdatePayload(activeForm.setting, payload);

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      clearDataError();
      setMessage(null);

      const result = await updateSetting(
        activeForm.setting.id,
        updatePayload,
      );

      if (result.success) {
        setActiveForm(null);
        setMessage(result.message);
      }
    }
  };

  const handleDelete = (setting: MaintenanceSetting) => {
    clearDeleteError();
    setDeleteCandidate(setting);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteCandidate(null);
    clearDeleteError();
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) {
      return;
    }

    clearDataError();
    setMessage(null);

    const result = await deleteSetting(deleteCandidate.id);

    if (result.success) {
      setDeleteCandidate(null);
      setMessage(result.message);
    }
  };

  return (
    <section className="maintenance-settings-panel">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <section className="admin-card maintenance-settings-card">
        <header>
          <div>
            <h2>Настройки обслуживания</h2>
          </div>

          {canManage ? (
            <div className="maintenance-settings-actions">
              <button
                className="admin-primary-button"
                disabled={
                  isLoading ||
                  isSaving ||
                  isAvailableTypesLoading ||
                  availableMaintenanceTypes.length === 0 ||
                  Boolean(availableTypesError)
                }
                onClick={() => openForm({ mode: "create" })}
                type="button"
              >
                <Plus aria-hidden="true" size={17} />
                Добавить настройку
              </button>
            </div>
          ) : null}
        </header>

        {canManage && availableTypesError ? (
          <div className="maintenance-settings-inline-error">
            <span>Не удалось загрузить доступные виды обслуживания.</span>
            <button
              disabled={isAvailableTypesLoading}
              onClick={() => void reloadAvailableMaintenanceTypes()}
              type="button"
            >
              Повторить
            </button>
          </div>
        ) : null}

        {isLoading ? <p className="admin-state">Загрузка...</p> : null}

        {!isLoading && settingsResponse?.settings.length === 0 ? (
          <p className="admin-state">
            Для модели этого оборудования пока нет настроек обслуживания.
          </p>
        ) : null}

        {!isLoading && settingsResponse?.settings.length ? (
          <MaintenanceSettingsTable
            canManage={canManage}
            onDelete={handleDelete}
            onEdit={(setting) => openForm({ mode: "edit", setting })}
            settings={settingsResponse.settings}
          />
        ) : null}
      </section>

      {activeForm ? (
        <MaintenanceSettingFormModal
          availableMaintenanceTypes={availableMaintenanceTypes}
          isSaving={isSaving}
          mode={activeForm.mode}
          onClose={() => {
            if (isSaving) {
              return;
            }

            clearFormError();
            setActiveForm(null);
          }}
          onSubmit={handleSubmit}
          serverErrorCode={formErrorCode}
          setting={activeForm.setting ?? null}
        />
      ) : null}

      {deleteCandidate ? (
        <ConfirmDialog
          cancelLabel="Отмена"
          confirmLabel="Удалить"
          description={
            <>
              Настройка «{deleteCandidate.maintenanceType.name}» будет удалена
              для всей модели оборудования. Уже созданные события не изменятся.
            </>
          }
          error={deleteError}
          isLoading={isDeleting}
          loadingLabel="Удаление..."
          onCancel={closeDeleteDialog}
          onConfirm={() => void confirmDelete()}
          title="Удалить настройку обслуживания?"
          variant="danger"
        />
      ) : null}
    </section>
  );
}
