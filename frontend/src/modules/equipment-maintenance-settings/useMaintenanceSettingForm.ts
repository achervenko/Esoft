import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
} from "../../shared/api/maintenance/maintenance.types";
import {
  buildMaintenanceSettingUpdatePayload,
  parseDefaultChecklistTemplateId,
  parsePeriodicityForm,
  toPeriodicityForm,
  type PeriodicityForm,
} from "./maintenance-setting-form-utils";
import type {
  MaintenanceSettingFormModalProps,
  MaintenanceSettingFormPayload,
} from "./maintenance-setting-form.types";

type UseMaintenanceSettingFormParams = Pick<
  MaintenanceSettingFormModalProps,
  | "availableMaintenanceTypes"
  | "checklistTemplates"
  | "isSaving"
  | "mode"
  | "onSubmit"
  | "setting"
>;

type InitialFormValues = {
  defaultChecklistTemplateId: string;
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
  resetKey: string;
  setting: MaintenanceSetting | null;
};

export function useMaintenanceSettingForm({
  availableMaintenanceTypes,
  checklistTemplates: publishedChecklistTemplates,
  isSaving,
  mode,
  onSubmit,
  setting = null,
}: UseMaintenanceSettingFormParams) {
  const formResetKey = `${mode}:${setting?.id ?? "new"}`;
  const initialFormValuesRef = useRef(
    createInitialFormValues(formResetKey, setting),
  );

  if (initialFormValuesRef.current.resetKey !== formResetKey) {
    initialFormValuesRef.current = createInitialFormValues(
      formResetKey,
      setting,
    );
  }

  const [maintenanceTypeId, setMaintenanceTypeId] = useState("");
  const [defaultChecklistTemplateId, setDefaultChecklistTemplateId] = useState(
    initialFormValuesRef.current.defaultChecklistTemplateId,
  );
  const [executionType, setExecutionType] = useState<MaintenanceExecutionType>(
    initialFormValuesRef.current.executionType,
  );
  const [hasPeriodicity, setHasPeriodicity] = useState(
    Boolean(initialFormValuesRef.current.periodicity),
  );
  const [periodicity, setPeriodicity] = useState<PeriodicityForm>(
    toPeriodicityForm(initialFormValuesRef.current.periodicity),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialValues = initialFormValuesRef.current;

    setMaintenanceTypeId("");
    setDefaultChecklistTemplateId(initialValues.defaultChecklistTemplateId);
    setExecutionType(initialValues.executionType);
    setHasPeriodicity(Boolean(initialValues.periodicity));
    setPeriodicity(toPeriodicityForm(initialValues.periodicity));
    setError(null);
  }, [formResetKey]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const maintenanceTypeOptions = useMemo(
    () =>
      availableMaintenanceTypes.map((maintenanceType) => ({
        label: maintenanceType.name,
        value: String(maintenanceType.id),
      })),
    [availableMaintenanceTypes],
  );

  const checklistTemplateOptions = useMemo(() => {
    const options = publishedChecklistTemplates.map((template) => ({
      label: template.name,
      value: String(template.id),
    }));
    const currentDefault = setting?.defaultChecklistTemplate;
    const shouldShowArchivedCurrentDefault =
      currentDefault?.state === "ARCHIVED" &&
      defaultChecklistTemplateId ===
        String(currentDefault.checklistTemplateId);

    if (
      shouldShowArchivedCurrentDefault &&
      !options.some(
        (option) =>
          option.value === String(currentDefault.checklistTemplateId),
      )
    ) {
      options.push({
        label: `${currentDefault.name} (архивный)`,
        value: String(currentDefault.checklistTemplateId),
      });
    }

    return options.sort((left, right) =>
      left.label.localeCompare(right.label, "ru"),
    );
  }, [defaultChecklistTemplateId, publishedChecklistTemplates, setting]);

  const updateMaintenanceTypeId = useCallback((value: string) => {
    setMaintenanceTypeId(value);
    clearError();
  }, [clearError]);

  const updateDefaultChecklistTemplateId = useCallback((value: string) => {
    setDefaultChecklistTemplateId(value);
    clearError();
  }, [clearError]);

  const updateExecutionType = useCallback((value: MaintenanceExecutionType) => {
    setExecutionType(value);
    clearError();
  }, [clearError]);

  const updatePeriodicity = (key: keyof PeriodicityForm, value: string) => {
    setPeriodicity((currentValue) => ({
      ...currentValue,
      [key]: value,
    }));
    clearError();
  };

  const applyPeriodicityPreset = (preset: MaintenancePeriodicity) => {
    setPeriodicity(toPeriodicityForm(preset));
    clearError();
  };

  const togglePeriodicity = (checked: boolean) => {
    setHasPeriodicity(checked);
    clearError();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const payload = buildSubmitPayload();

    if (!payload) {
      return;
    }

    clearError();
    onSubmit(payload);
  };

  const buildSubmitPayload = (): MaintenanceSettingFormPayload | null => {
    const parsedDefaultChecklistTemplateId = parseDefaultChecklistTemplateId(
      defaultChecklistTemplateId,
    );

    if (!parsedDefaultChecklistTemplateId.ok) {
      setError("Укажите корректный шаблон чек-листа.");
      return null;
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
      return null;
    }

    if (mode === "create") {
      const parsedMaintenanceTypeId = Number(maintenanceTypeId);

      if (
        !Number.isSafeInteger(parsedMaintenanceTypeId) ||
        parsedMaintenanceTypeId <= 0
      ) {
        setError("Выберите вид обслуживания.");
        return null;
      }

      return {
        defaultChecklistTemplateId: parsedDefaultChecklistTemplateId.value,
        maintenanceTypeId: parsedMaintenanceTypeId,
        executionType,
        periodicity: parsedPeriodicityResult.value,
      };
    }

    if (mode === "edit" && initialFormValuesRef.current.setting) {
      const updatePayload = buildMaintenanceSettingUpdatePayload(
        initialFormValuesRef.current.setting,
        {
          defaultChecklistTemplateId: parsedDefaultChecklistTemplateId.value,
          executionType,
          periodicity: parsedPeriodicityResult.value,
        },
      );

      if (Object.keys(updatePayload).length === 0) {
        setError("Нет изменений для сохранения.");
        return null;
      }

      return {
        defaultChecklistTemplateId: parsedDefaultChecklistTemplateId.value,
        executionType,
        periodicity: parsedPeriodicityResult.value,
        updatePayload,
      };
    }

    setError("Некорректное состояние формы настройки обслуживания.");
    return null;
  };

  return {
    applyPeriodicityPreset,
    checklistTemplateOptions,
    defaultChecklistTemplateId,
    error,
    executionType,
    handleSubmit,
    hasPeriodicity,
    maintenanceTypeId,
    maintenanceTypeOptions,
    periodicity,
    togglePeriodicity,
    updateDefaultChecklistTemplateId,
    updateExecutionType,
    updateMaintenanceTypeId,
    updatePeriodicity,
  };
}

function createInitialFormValues(
  resetKey: string,
  setting: MaintenanceSetting | null,
): InitialFormValues {
  return {
    defaultChecklistTemplateId: setting?.defaultChecklistTemplate
      ? String(setting.defaultChecklistTemplate.checklistTemplateId)
      : "",
    executionType: setting?.executionType ?? "INTERNAL",
    periodicity: setting?.periodicity ?? null,
    resetKey,
    setting,
  };
}
