import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createMaintenanceSetting,
  deleteMaintenanceSetting,
  getAvailableMaintenanceTypes,
  getMaintenanceSettings,
  updateMaintenanceSetting,
  ApiRequestError,
  type MaintenanceType,
  type MaintenanceSetting,
  type MaintenanceSettingsResponse,
} from "../../shared/api/equipment-api";
import "../../shared/ui/AdminPage.css";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { Notice } from "../../shared/ui/Notice";
import { MaintenanceSettingFormModal } from "./MaintenanceSettingFormModal";
import type { MaintenanceSettingFormPayload } from "./MaintenanceSettingFormModal";
import { MaintenanceSettingsTable } from "./MaintenanceSettingsTable";
import { buildMaintenanceSettingUpdatePayload } from "./maintenance-setting-form-utils";
import { getMaintenanceSettingsErrorMessage } from "./maintenance-settings-errors";
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
  const [settingsResponse, setSettingsResponse] =
    useState<MaintenanceSettingsResponse | null>(null);
  const [availableMaintenanceTypes, setAvailableMaintenanceTypes] = useState<
    MaintenanceType[]
  >([]);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailableTypesLoading, setIsAvailableTypesLoading] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTypesError, setAvailableTypesError] = useState<string | null>(
    null,
  );
  const [deleteCandidate, setDeleteCandidate] =
    useState<MaintenanceSetting | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setIsAvailableTypesLoading(false);
    setSettingsResponse(null);
    setAvailableMaintenanceTypes([]);
    setActiveForm(null);
    setDeleteCandidate(null);
    setDeleteError(null);
    setIsDeleting(false);
    setError(null);
    setAvailableTypesError(null);
    setFormErrorCode(null);
    setMessage(null);

    getMaintenanceSettings(visibleId)
      .then((settingsData) => {
        if (isMounted) {
          setSettingsResponse(settingsData);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(getMaintenanceSettingsErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    if (canManage) {
      void loadAvailableMaintenanceTypes({
        shouldApply: () => isMounted,
      });
    }

    return () => {
      isMounted = false;
    };
  }, [canManage, visibleId]);

  const runSavingAction = async (
    action: () => Promise<MaintenanceSettingsResponse>,
    successMessage: string,
  ) => {
    setIsSaving(true);
    setError(null);
    setFormErrorCode(null);
    setMessage(null);

    try {
      const previousSettingsResponse = settingsResponse;
      const nextSettingsResponse = await action();
      setSettingsResponse(nextSettingsResponse);
      setAvailableMaintenanceTypes((currentAvailableTypes) =>
        reconcileAvailableMaintenanceTypes(
          currentAvailableTypes,
          nextSettingsResponse,
          previousSettingsResponse,
        ),
      );
      setActiveForm(null);
      setMessage(successMessage);
      setAvailableTypesError(null);

      if (canManage) {
        void refreshAvailableMaintenanceTypes({ silentError: true });
      }
    } catch (requestError) {
      const errorMessage = getMaintenanceSettingsErrorMessage(requestError);

      if (requestError instanceof ApiRequestError) {
        setFormErrorCode(requestError.code ?? null);

        if (requestError.code === "MAINTENANCE_SETTING_NOT_FOUND") {
          setActiveForm(null);

          try {
            await reloadMaintenanceSettingsData();
            setError(null);
            setMessage("Данные обновлены.");
            return;
          } catch (reloadError) {
            setError(getMaintenanceSettingsErrorMessage(reloadError));
            return;
          }
        }
      }

      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const reloadMaintenanceSettingsData = async () => {
    const settingsData = await getMaintenanceSettings(visibleId);

    setSettingsResponse(settingsData);

    if (canManage) {
      await refreshAvailableMaintenanceTypes();
    } else {
      setAvailableMaintenanceTypes([]);
    }
  };

  const refreshAvailableMaintenanceTypes = async (options?: {
    silentError?: boolean;
  }) => {
    await loadAvailableMaintenanceTypes(options);
  };

  const loadAvailableMaintenanceTypes = async (options?: {
    silentError?: boolean;
    shouldApply?: () => boolean;
  }) => {
    setIsAvailableTypesLoading(true);
    setAvailableTypesError(null);

    try {
      const nextAvailableMaintenanceTypes =
        await getAvailableMaintenanceTypes(visibleId);

      if (options?.shouldApply?.() !== false) {
        setAvailableMaintenanceTypes(
          nextAvailableMaintenanceTypes.maintenanceTypes,
        );
      }
    } catch (requestError) {
      if (options?.shouldApply?.() !== false && !options?.silentError) {
        setAvailableTypesError(getMaintenanceSettingsErrorMessage(requestError));
      }
    } finally {
      if (options?.shouldApply?.() !== false) {
        setIsAvailableTypesLoading(false);
      }
    }
  };

  const openForm = (form: ActiveForm) => {
    setFormErrorCode(null);
    setActiveForm(form);
  };

  const handleSubmit = (payload: MaintenanceSettingFormPayload) => {
    if (!activeForm) {
      return;
    }

    if (activeForm.mode === "create" && payload.maintenanceTypeId) {
      const maintenanceTypeId = payload.maintenanceTypeId;

      void runSavingAction(
        () =>
          createMaintenanceSetting(visibleId, {
            checklistTemplateId: payload.checklistTemplateId,
            maintenanceTypeId,
            executionType: payload.executionType,
            periodicity: payload.periodicity,
          }),
        "Настройка обслуживания добавлена.",
      );
      return;
    }

    if (activeForm.mode === "edit") {
      const updatePayload =
        payload.updatePayload ??
        buildMaintenanceSettingUpdatePayload(activeForm.setting, payload);

      if (Object.keys(updatePayload).length === 0) {
        setError("Нет изменений для сохранения.");
        return;
      }

      void runSavingAction(
        () =>
          updateMaintenanceSetting(
            visibleId,
            activeForm.setting.id,
            updatePayload,
          ),
        "Настройка обслуживания обновлена.",
      );
    }
  };

  const handleDelete = (setting: MaintenanceSetting) => {
    setDeleteError(null);
    setDeleteCandidate(setting);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteCandidate(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setError(null);
    setMessage(null);

    try {
      const previousSettingsResponse = settingsResponse;
      const nextSettingsResponse = await deleteMaintenanceSetting(
        visibleId,
        deleteCandidate.id,
      );
      setSettingsResponse(nextSettingsResponse);
      setAvailableMaintenanceTypes((currentAvailableTypes) =>
        reconcileAvailableMaintenanceTypes(
          currentAvailableTypes,
          nextSettingsResponse,
          previousSettingsResponse,
        ),
      );
      setDeleteCandidate(null);
      setMessage("Настройка обслуживания удалена.");
      setAvailableTypesError(null);

      if (canManage) {
        void refreshAvailableMaintenanceTypes({ silentError: true });
      }
    } catch (requestError) {
      if (
        requestError instanceof ApiRequestError &&
        requestError.code === "MAINTENANCE_SETTING_NOT_FOUND"
      ) {
        try {
          await reloadMaintenanceSettingsData();
          setDeleteCandidate(null);
          setDeleteError(null);
          setMessage("Настройка уже удалена. Данные обновлены.");
          return;
        } catch (reloadError) {
          setDeleteError(getMaintenanceSettingsErrorMessage(reloadError));
          return;
        }
      }

      setDeleteError(getMaintenanceSettingsErrorMessage(requestError));
    } finally {
      setIsDeleting(false);
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
              onClick={() => void refreshAvailableMaintenanceTypes()}
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
            setFormErrorCode(null);
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

function reconcileAvailableMaintenanceTypes(
  currentAvailableTypes: MaintenanceType[],
  nextSettingsResponse: MaintenanceSettingsResponse,
  previousSettingsResponse: MaintenanceSettingsResponse | null,
) {
  const typeById = new Map<number, MaintenanceType>();

  for (const maintenanceType of currentAvailableTypes) {
    typeById.set(maintenanceType.id, maintenanceType);
  }

  for (const setting of previousSettingsResponse?.settings ?? []) {
    typeById.set(setting.maintenanceType.id, setting.maintenanceType);
  }

  for (const setting of nextSettingsResponse.settings) {
    typeById.set(setting.maintenanceType.id, setting.maintenanceType);
  }

  const assignedTypeIds = new Set(
    nextSettingsResponse.settings.map((setting) => setting.maintenanceType.id),
  );

  return Array.from(typeById.values())
    .filter(
      (maintenanceType) =>
        !assignedTypeIds.has(maintenanceType.id) &&
        maintenanceType.isActive !== false,
    )
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
}
