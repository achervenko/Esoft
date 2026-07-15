import { useMemo, useState } from "react";
import type {
  MaintenanceType,
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { PeriodicityFields } from "./PeriodicityFields";
import { getFieldErrorsByCode } from "./maintenance-setting-form-errors";
import {
  buildMaintenanceSettingUpdatePayload,
  emptyPeriodicityForm,
  parseNullablePositiveInteger,
  parsePeriodicityForm,
  toPeriodicityForm,
  type PeriodicityForm,
} from "./maintenance-setting-form-utils";
import { executionTypeLabels } from "./maintenance-settings-utils";

type MaintenanceSettingFormMode = "create" | "edit";

export type MaintenanceSettingFormPayload = {
  checklistTemplateId: number | null;
  maintenanceTypeId?: number;
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
  updatePayload?: MaintenanceSettingUpdatePayload;
};

type MaintenanceSettingFormModalProps = {
  availableMaintenanceTypes: MaintenanceType[];
  isSaving: boolean;
  mode: MaintenanceSettingFormMode;
  onClose: () => void;
  onSubmit: (payload: MaintenanceSettingFormPayload) => void;
  serverErrorCode?: string | null;
  setting?: MaintenanceSetting | null;
};

const executionTypeOptions = [
  { label: executionTypeLabels.INTERNAL, value: "INTERNAL" },
  { label: executionTypeLabels.EXTERNAL, value: "EXTERNAL" },
];

export function MaintenanceSettingFormModal({
  availableMaintenanceTypes,
  isSaving,
  mode,
  onClose,
  onSubmit,
  serverErrorCode = null,
  setting = null,
}: MaintenanceSettingFormModalProps) {
  const initialPeriodicity = setting?.periodicity ?? null;
  const [maintenanceTypeId, setMaintenanceTypeId] = useState("");
  const [checklistTemplateId, setChecklistTemplateId] = useState(
    setting?.checklistTemplateId ? String(setting.checklistTemplateId) : "",
  );
  const [executionType, setExecutionType] = useState<MaintenanceExecutionType>(
    setting?.executionType ?? "INTERNAL",
  );
  const [hasPeriodicity, setHasPeriodicity] = useState(
    Boolean(initialPeriodicity),
  );
  const [periodicity, setPeriodicity] = useState<PeriodicityForm>(
    toPeriodicityForm(initialPeriodicity),
  );
  const [error, setError] = useState<string | null>(null);
  const fieldErrors = getFieldErrorsByCode(serverErrorCode);

  const title = useMemo(() => {
    if (mode === "edit") {
      return "Редактирование настройки";
    }

    return "Назначить вид обслуживания";
  }, [mode]);
  const maintenanceTypeOptions = useMemo(
    () =>
      availableMaintenanceTypes.map((maintenanceType) => ({
        label: maintenanceType.name,
        value: String(maintenanceType.id),
      })),
    [availableMaintenanceTypes],
  );

  const updatePeriodicity = (key: keyof PeriodicityForm, value: string) => {
    setPeriodicity((currentValue) => ({
      ...currentValue,
      [key]: value,
    }));
  };

  const applyPeriodicityPreset = (preset: MaintenancePeriodicity) => {
    setPeriodicity(toPeriodicityForm(preset));
    setError(null);
  };

  const togglePeriodicity = (checked: boolean) => {
    setHasPeriodicity(checked);
    setPeriodicity(emptyPeriodicityForm);
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const parsedChecklistTemplateId =
      parseNullablePositiveInteger(checklistTemplateId);

    if (parsedChecklistTemplateId === undefined) {
      setError("Некорректный ID шаблона чек-листа.");
      return;
    }

    const parsedPeriodicityResult = parsePeriodicityForm(
      hasPeriodicity,
      periodicity,
    );

    if (!parsedPeriodicityResult.ok) {
      setError(
        parsedPeriodicityResult.reason === "empty"
          ? "Укажите периодичность больше нуля."
          : "Периодичность должна состоять из целых неотрицательных чисел.",
      );
      return;
    }

    if (mode === "create") {
      const parsedMaintenanceTypeId = Number(maintenanceTypeId);

      if (
        !Number.isSafeInteger(parsedMaintenanceTypeId) ||
        parsedMaintenanceTypeId <= 0
      ) {
        setError("Выберите вид обслуживания.");
        return;
      }

      setError(null);
      onSubmit({
        checklistTemplateId: parsedChecklistTemplateId,
        maintenanceTypeId: parsedMaintenanceTypeId,
        executionType,
        periodicity: parsedPeriodicityResult.value,
      });
      return;
    }

    if (mode === "edit" && setting) {
      const updatePayload = buildMaintenanceSettingUpdatePayload(setting, {
        checklistTemplateId: parsedChecklistTemplateId,
        executionType,
        periodicity: parsedPeriodicityResult.value,
      });

      if (Object.keys(updatePayload).length === 0) {
        setError("Нет изменений для сохранения.");
        return;
      }

      setError(null);
      onSubmit({
        checklistTemplateId: parsedChecklistTemplateId,
        executionType,
        periodicity: parsedPeriodicityResult.value,
        updatePayload,
      });
      return;
    }

    setError(null);
    onSubmit({
      checklistTemplateId: parsedChecklistTemplateId,
      executionType,
      periodicity: parsedPeriodicityResult.value,
    });
  };

  return (
    <AdminModal onClose={onClose} title={title}>
      <form
        className="admin-form maintenance-settings-form"
        onSubmit={handleSubmit}
      >
        {mode === "create" ? (
          <SelectDropdown
            error={fieldErrors.maintenanceTypeId}
            label="Вид обслуживания"
            onChange={setMaintenanceTypeId}
            options={maintenanceTypeOptions}
            placeholder="Выберите вид обслуживания"
            required
            value={maintenanceTypeId}
          />
        ) : null}

        <SelectDropdown
          error={fieldErrors.executionType}
          label="Способ выполнения"
          onChange={(value) =>
            setExecutionType(value as MaintenanceExecutionType)
          }
          options={executionTypeOptions}
          required
          value={executionType}
        />

        <label
          className={`form-field${fieldErrors.checklistTemplateId ? " has-error" : ""}`}
        >
          <span>ID шаблона чек-листа</span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              setChecklistTemplateId(event.target.value.replace(/\D/g, ""))
            }
            placeholder="Не указан"
            value={checklistTemplateId}
          />
          {fieldErrors.checklistTemplateId ? (
            <small className="field-error">
              {fieldErrors.checklistTemplateId}
            </small>
          ) : null}
        </label>

        <PeriodicityFields
          error={fieldErrors.periodicity}
          hasPeriodicity={hasPeriodicity}
          onHasPeriodicityChange={togglePeriodicity}
          onPresetApply={applyPeriodicityPreset}
          onValueChange={updatePeriodicity}
          value={periodicity}
        />

        {error ? <p className="admin-form-error">{error}</p> : null}

        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
