import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { useNotifications } from "../../shared/ui/notifications";
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
  const { notifyError, notifyWarning } = useNotifications();
  const [activeForm, setActiveForm] =
    useState<MaintenanceSettingsPanelActiveForm | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<MaintenanceSetting | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const notifiedErrorsRef = useRef(new Set<string>());
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
  }, [clearDataError]);

  useEffect(() => {
    notifiedErrorsRef.current.clear();
  }, [visibleId]);

  useEffect(() => {
    notifyMaintenanceSettingsError(
      "settings",
      "Не удалось загрузить настройки обслуживания",
      error,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [error, notifyError]);

  useEffect(() => {
    notifyMaintenanceSettingsError(
      "available-types",
      "Не удалось загрузить виды обслуживания",
      availableTypesError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [availableTypesError, notifyError]);

  useEffect(() => {
    notifyMaintenanceSettingsError(
      "checklist-templates",
      "Не удалось загрузить шаблоны чек-листов",
      checklistTemplatesError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [checklistTemplatesError, notifyError]);

  useEffect(() => {
    notifyMaintenanceSettingsError(
      "form",
      "Не удалось сохранить настройку обслуживания",
      formErrorMessage,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [formErrorMessage, notifyError]);

  useEffect(() => {
    notifyMaintenanceSettingsError(
      "delete",
      "Не удалось удалить настройку обслуживания",
      deleteError,
      notifiedErrorsRef.current,
      notifyError,
    );
  }, [deleteError, notifyError]);

  const openForm = useCallback(
    (form: MaintenanceSettingsPanelActiveForm) => {
      clearFormError();
      setClientError(null);
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
          const errorMessage =
            "Некорректное состояние формы настройки обслуживания.";
          setClientError(errorMessage);
          notifyWarning(errorMessage);
          return;
        }

        if (!payload.maintenanceTypeId) {
          const errorMessage = "Выберите вид обслуживания.";
          setClientError(errorMessage);
          notifyWarning(errorMessage);
          return;
        }

        if (!payload.defaultChecklistTemplateId) {
          const errorMessage = "Выберите шаблон чек-листа.";
          setClientError(errorMessage);
          notifyWarning(errorMessage);
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
        }

        return;
      }

      if (payload.mode !== "edit") {
        const errorMessage = "Форма редактирования не вернула изменения.";
        setClientError(errorMessage);
        notifyWarning(errorMessage);
        return;
      }

      if (Object.keys(payload.updatePayload).length === 0) {
        const errorMessage = "Нет изменений для сохранения.";
        setClientError(errorMessage);
        notifyWarning(errorMessage);
        return;
      }

      clearFeedback();

      const result = await updateSetting(
        activeForm.setting.id,
        payload.updatePayload,
      );

      if (result.success) {
        setActiveForm(null);
      }
    },
    [
      activeForm,
      clearFeedback,
      createSetting,
      notifyWarning,
      updateSetting,
    ],
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

function notifyMaintenanceSettingsError(
  key: string,
  title: string,
  message: string | null,
  notifiedErrors: Set<string>,
  notifyError: (title: string, message?: string) => string,
) {
  if (!message) {
    removeNotifiedErrorKey(key, notifiedErrors);
    return;
  }

  const fingerprint = `${key}:${message}`;

  if (notifiedErrors.has(fingerprint)) {
    return;
  }

  notifiedErrors.add(fingerprint);
  notifyError(title, message);
}

function removeNotifiedErrorKey(key: string, notifiedErrors: Set<string>) {
  const prefix = `${key}:`;

  for (const fingerprint of notifiedErrors) {
    if (fingerprint.startsWith(prefix)) {
      notifiedErrors.delete(fingerprint);
    }
  }
}
