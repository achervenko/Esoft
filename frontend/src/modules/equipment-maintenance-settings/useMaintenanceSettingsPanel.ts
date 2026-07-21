import { useCallback, useMemo, useState } from "react";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import type { MaintenanceSettingFormPayload } from "./maintenance-setting-form.types";
import type {
  MaintenanceSettingsPanelActiveForm,
  MaintenanceSettingsPanelProps,
} from "./maintenance-settings-panel.types";
import { useMaintenanceSettingActions } from "./useMaintenanceSettingActions";
import { useMaintenanceSettingsData } from "./useMaintenanceSettingsData";

type UseMaintenanceSettingsPanelParams = MaintenanceSettingsPanelProps;

export function useMaintenanceSettingsPanel({
  canManage,
  visibleId,
}: UseMaintenanceSettingsPanelParams) {
  const [activeForm, setActiveForm] =
    useState<MaintenanceSettingsPanelActiveForm | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<MaintenanceSetting | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    applySettingsResponse,
    availableMaintenanceTypes,
    availableTypesError,
    checklistTemplates,
    checklistTemplatesError,
    clearDataError,
    error,
    isAvailableTypesLoading,
    isChecklistTemplatesLoading,
    isLoading,
    reloadAvailableMaintenanceTypes,
    reloadChecklistTemplates,
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
    formErrorMessage,
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

  const clearFeedback = useCallback(() => {
    clearDataError();
    setClientError(null);
    setMessage(null);
  }, [clearDataError]);

  const openForm = useCallback(
    (form: MaintenanceSettingsPanelActiveForm) => {
      clearFormError();
      setClientError(null);
      setMessage(null);
      setActiveForm(form);
    },
    [clearFormError],
  );

  const closeForm = useCallback(() => {
    if (isSaving) {
      return;
    }

    clearFormError();
    setClientError(null);
    setActiveForm(null);
  }, [clearFormError, isSaving]);

  const openCreateForm = useCallback(() => {
    openForm({ mode: "create" });
  }, [openForm]);

  const openEditForm = useCallback(
    (setting: MaintenanceSetting) => {
      openForm({ mode: "edit", setting });
    },
    [openForm],
  );

  const handleSubmit = useCallback(
    async (payload: MaintenanceSettingFormPayload) => {
      if (!activeForm) {
        return;
      }

      if (activeForm.mode === "create") {
        if (payload.mode !== "create") {
          setClientError("Некорректное состояние формы настройки обслуживания.");
          return;
        }

        if (!payload.maintenanceTypeId) {
          setClientError("Выберите вид обслуживания.");
          return;
        }

        if (!payload.defaultChecklistTemplateId) {
          setClientError("Выберите шаблон чек-листа.");
          return;
        }

        clearFeedback();

        const result = await createSetting({
          defaultChecklistTemplateId: payload.defaultChecklistTemplateId,
          maintenanceTypeId: payload.maintenanceTypeId,
          executionType: payload.executionType,
          periodicity: payload.periodicity,
        });

        if (result.success) {
          setActiveForm(null);
          setMessage(result.message);
        }

        return;
      }

      if (payload.mode !== "edit") {
        setClientError("Форма редактирования не вернула изменения.");
        return;
      }

      if (Object.keys(payload.updatePayload).length === 0) {
        setClientError("Нет изменений для сохранения.");
        return;
      }

      clearFeedback();

      const result = await updateSetting(
        activeForm.setting.id,
        payload.updatePayload,
      );

      if (result.success) {
        setActiveForm(null);
        setMessage(result.message);
      }
    },
    [activeForm, clearFeedback, createSetting, updateSetting],
  );

  const requestDelete = useCallback(
    (setting: MaintenanceSetting) => {
      clearDeleteError();
      setClientError(null);
      setDeleteCandidate(setting);
    },
    [clearDeleteError],
  );

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) {
      return;
    }

    setDeleteCandidate(null);
    clearDeleteError();
  }, [clearDeleteError, isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteCandidate) {
      return;
    }

    clearFeedback();

    const result = await deleteSetting(deleteCandidate.id);

    if (result.success) {
      setDeleteCandidate(null);
      setMessage(result.message);
    }
  }, [clearFeedback, deleteCandidate, deleteSetting]);

  const isCreateDisabled =
    isLoading ||
    isSaving ||
    isAvailableTypesLoading ||
    isChecklistTemplatesLoading ||
    availableMaintenanceTypes.length === 0 ||
    checklistTemplates.length === 0 ||
    Boolean(availableTypesError) ||
    Boolean(checklistTemplatesError);

  const modalState = useMemo(
    () => ({
      activeForm,
      deleteCandidate,
    }),
    [activeForm, deleteCandidate],
  );

  return {
    availableMaintenanceTypes,
    availableTypesError,
    checklistTemplates,
    checklistTemplatesError,
    clientError,
    dataError: error,
    deleteError,
    formErrorCode,
    formErrorMessage,
    isAvailableTypesLoading,
    isChecklistTemplatesLoading,
    isCreateDisabled,
    isDeleting,
    isLoading,
    isSaving,
    message,
    modalState,
    reloadAvailableMaintenanceTypes,
    reloadChecklistTemplates,
    settings: settingsResponse?.settings ?? null,
    closeDeleteDialog,
    closeForm,
    confirmDelete,
    handleSubmit,
    openCreateForm,
    openEditForm,
    requestDelete,
  };
}
