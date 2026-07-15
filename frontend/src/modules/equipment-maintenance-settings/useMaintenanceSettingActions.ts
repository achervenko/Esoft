import { useCallback, useRef, useState } from "react";
import { ApiRequestError } from "../../shared/api/api-error";
import {
  createMaintenanceSetting,
  deleteMaintenanceSetting,
  updateMaintenanceSetting,
} from "../../shared/api/maintenance/maintenance.api";
import type {
  MaintenanceSettingPayload,
  MaintenanceSettingsResponse,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";
import { getMaintenanceSettingsErrorMessage } from "./maintenance-settings-errors";

export type MaintenanceSettingActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
    };

type UseMaintenanceSettingActionsOptions = {
  applySettingsResponse: (
    response: MaintenanceSettingsResponse,
    previousResponse?: MaintenanceSettingsResponse | null,
  ) => void;
  canManage: boolean;
  reloadAvailableMaintenanceTypes: (options?: {
    silentError?: boolean;
  }) => Promise<unknown>;
  reloadMaintenanceSettings: () => Promise<MaintenanceSettingsResponse | null>;
  settingsResponse: MaintenanceSettingsResponse | null;
  visibleId: number;
};

export function useMaintenanceSettingActions({
  applySettingsResponse,
  canManage,
  reloadAvailableMaintenanceTypes,
  reloadMaintenanceSettings,
  settingsResponse,
  visibleId,
}: UseMaintenanceSettingActionsOptions) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const deletingOperationRef = useRef<symbol | null>(null);
  const savingOperationRef = useRef<symbol | null>(null);
  const visibleIdRef = useRef(visibleId);

  visibleIdRef.current = visibleId;

  const isCurrentVisibleId = useCallback(
    (requestVisibleId: number) => visibleIdRef.current === requestVisibleId,
    [],
  );

  const reloadAfterConflict = useCallback(async () => {
    const settingsData = await reloadMaintenanceSettings();

    if (!settingsData) {
      return false;
    }

    if (canManage) {
      const availableTypesResponse = await reloadAvailableMaintenanceTypes();

      if (!availableTypesResponse) {
        return false;
      }
    }

    return true;
  }, [
    canManage,
    reloadAvailableMaintenanceTypes,
    reloadMaintenanceSettings,
  ]);

  const runSavingAction = useCallback(
    async (
      request: () => Promise<MaintenanceSettingsResponse>,
      successMessage: string,
    ): Promise<MaintenanceSettingActionResult> => {
      if (savingOperationRef.current !== null) {
        return { success: false };
      }

      const operationId = Symbol();
      const operationVisibleId = visibleId;
      savingOperationRef.current = operationId;
      setIsSaving(true);
      setFormErrorCode(null);

      try {
        const previousSettingsResponse = settingsResponse;
        const nextSettingsResponse = await request();

        if (!isCurrentVisibleId(operationVisibleId)) {
          return { success: false };
        }

        applySettingsResponse(nextSettingsResponse, previousSettingsResponse);

        if (canManage) {
          void reloadAvailableMaintenanceTypes({ silentError: true });
        }

        return {
          message: successMessage,
          success: true,
        };
      } catch (requestError) {
        if (!isCurrentVisibleId(operationVisibleId)) {
          return { success: false };
        }

        if (requestError instanceof ApiRequestError) {
          setFormErrorCode(requestError.code ?? null);

          if (requestError.code === "MAINTENANCE_SETTING_NOT_FOUND") {
            const didReload = await reloadAfterConflict();

            if (!didReload) {
              return { success: false };
            }

            return {
              message: "Данные обновлены.",
              success: true,
            };
          }
        }

        return { success: false };
      } finally {
        if (savingOperationRef.current === operationId) {
          savingOperationRef.current = null;

          if (isCurrentVisibleId(operationVisibleId)) {
            setIsSaving(false);
          }
        }
      }
    },
    [
      applySettingsResponse,
      canManage,
      isCurrentVisibleId,
      reloadAvailableMaintenanceTypes,
      reloadAfterConflict,
      settingsResponse,
      visibleId,
    ],
  );

  const createSetting = useCallback(
    (payload: MaintenanceSettingPayload) =>
      runSavingAction(
        () => createMaintenanceSetting(visibleId, payload),
        "Настройка обслуживания добавлена.",
      ),
    [runSavingAction, visibleId],
  );

  const updateSetting = useCallback(
    (settingId: number, payload: MaintenanceSettingUpdatePayload) =>
      runSavingAction(
        () => updateMaintenanceSetting(visibleId, settingId, payload),
        "Настройка обслуживания обновлена.",
      ),
    [runSavingAction, visibleId],
  );

  const deleteSetting = useCallback(
    async (settingId: number): Promise<MaintenanceSettingActionResult> => {
      if (deletingOperationRef.current !== null) {
        return { success: false };
      }

      const operationId = Symbol();
      const operationVisibleId = visibleId;
      deletingOperationRef.current = operationId;
      setIsDeleting(true);
      setDeleteError(null);

      try {
        const previousSettingsResponse = settingsResponse;
        const nextSettingsResponse = await deleteMaintenanceSetting(
          operationVisibleId,
          settingId,
        );

        if (!isCurrentVisibleId(operationVisibleId)) {
          return { success: false };
        }

        applySettingsResponse(nextSettingsResponse, previousSettingsResponse);

        if (canManage) {
          void reloadAvailableMaintenanceTypes({ silentError: true });
        }

        return {
          message: "Настройка обслуживания удалена.",
          success: true,
        };
      } catch (requestError) {
        if (!isCurrentVisibleId(operationVisibleId)) {
          return { success: false };
        }

        if (
          requestError instanceof ApiRequestError &&
          requestError.code === "MAINTENANCE_SETTING_NOT_FOUND"
        ) {
          const didReload = await reloadAfterConflict();

          if (!didReload) {
            return { success: false };
          }

          return {
            message: "Настройка уже удалена. Данные обновлены.",
            success: true,
          };
        }

        setDeleteError(getMaintenanceSettingsErrorMessage(requestError));
        return { success: false };
      } finally {
        if (deletingOperationRef.current === operationId) {
          deletingOperationRef.current = null;

          if (isCurrentVisibleId(operationVisibleId)) {
            setIsDeleting(false);
          }
        }
      }
    },
    [
      applySettingsResponse,
      canManage,
      isCurrentVisibleId,
      reloadAvailableMaintenanceTypes,
      reloadAfterConflict,
      settingsResponse,
      visibleId,
    ],
  );

  return {
    clearDeleteError: () => setDeleteError(null),
    clearFormError: () => setFormErrorCode(null),
    createSetting,
    deleteError,
    deleteSetting,
    formErrorCode,
    isDeleting,
    isSaving,
    updateSetting,
  };
}
