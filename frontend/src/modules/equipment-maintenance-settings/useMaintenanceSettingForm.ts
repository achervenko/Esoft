import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
} from "../../shared/api/maintenance/maintenance.types";
import {
  buildMaintenanceSettingUpdatePayload,
  emptyPeriodicityForm,
  parseChecklistTemplateFormItems,
  parsePeriodicityForm,
  toPeriodicityForm,
  type PeriodicityForm,
} from "./maintenance-setting-form-utils";
import type {
  MaintenanceSettingFormModalProps,
  MaintenanceSettingFormPayload,
} from "./maintenance-setting-form.types";
import { useMaintenanceChecklistTemplates } from "./useMaintenanceChecklistTemplates";

type UseMaintenanceSettingFormParams = Pick<
  MaintenanceSettingFormModalProps,
  | "availableMaintenanceTypes"
  | "isSaving"
  | "mode"
  | "onSubmit"
  | "setting"
>;

type InitialFormValues = {
  checklistTemplates: MaintenanceSetting["checklistTemplates"];
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
  resetKey: string;
  setting: MaintenanceSetting | null;
};

export function useMaintenanceSettingForm({
  availableMaintenanceTypes,
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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const {
    addChecklistTemplate,
    checklistTemplates,
    moveChecklistTemplate,
    removeChecklistTemplate,
    updateChecklistTemplate,
  } = useMaintenanceChecklistTemplates({
    initialTemplates: initialFormValuesRef.current.checklistTemplates,
    onChange: clearError,
    resetKey: formResetKey,
  });

  useEffect(() => {
    const initialValues = initialFormValuesRef.current;

    setMaintenanceTypeId("");
    setExecutionType(initialValues.executionType);
    setHasPeriodicity(Boolean(initialValues.periodicity));
    setPeriodicity(toPeriodicityForm(initialValues.periodicity));
    setError(null);
  }, [formResetKey]);

  const maintenanceTypeOptions = useMemo(
    () =>
      availableMaintenanceTypes.map((maintenanceType) => ({
        label: maintenanceType.name,
        value: String(maintenanceType.id),
      })),
    [availableMaintenanceTypes],
  );

  const updateMaintenanceTypeId = useCallback(
    (value: string) => {
      setMaintenanceTypeId(value);
      clearError();
    },
    [clearError],
  );

  const updateExecutionType = useCallback(
    (value: MaintenanceExecutionType) => {
      setExecutionType(value);
      clearError();
    },
    [clearError],
  );

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
    setPeriodicity(emptyPeriodicityForm);
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
    const parsedChecklistTemplatesResult =
      parseChecklistTemplateFormItems(checklistTemplates);

    if (!parsedChecklistTemplatesResult.ok) {
      setError(
        parsedChecklistTemplatesResult.reason === "duplicate"
          ? "Шаблоны чек-листов не должны повторяться."
          : "Укажите корректные ID шаблонов чек-листов.",
      );
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
        checklistTemplates: parsedChecklistTemplatesResult.value,
        maintenanceTypeId: parsedMaintenanceTypeId,
        executionType,
        periodicity: parsedPeriodicityResult.value,
      };
    }

    if (mode === "edit" && initialFormValuesRef.current.setting) {
      const updatePayload = buildMaintenanceSettingUpdatePayload(
        initialFormValuesRef.current.setting,
        {
          checklistTemplates: parsedChecklistTemplatesResult.value,
          executionType,
          periodicity: parsedPeriodicityResult.value,
        },
      );

      if (Object.keys(updatePayload).length === 0) {
        setError("Нет изменений для сохранения.");
        return null;
      }

      return {
        checklistTemplates: parsedChecklistTemplatesResult.value,
        executionType,
        periodicity: parsedPeriodicityResult.value,
        updatePayload,
      };
    }

    setError("Некорректное состояние формы настройки обслуживания.");
    return null;
  };

  return {
    addChecklistTemplate,
    applyPeriodicityPreset,
    checklistTemplates,
    error,
    executionType,
    handleSubmit,
    hasPeriodicity,
    maintenanceTypeId,
    maintenanceTypeOptions,
    moveChecklistTemplate,
    periodicity,
    removeChecklistTemplate,
    togglePeriodicity,
    updateChecklistTemplate,
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
    checklistTemplates: setting?.checklistTemplates ?? [],
    executionType: setting?.executionType ?? "INTERNAL",
    periodicity: setting?.periodicity ?? null,
    resetKey,
    setting,
  };
}
