import type { MaintenanceExecutionType } from "../../shared/api/maintenance/maintenance.types";
import { AdminFormActions } from "../../shared/ui/AdminFormControls";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { PeriodicityFields } from "./PeriodicityFields";
import { getFieldErrorsByCode } from "./maintenance-setting-form-errors";
import type { MaintenanceSettingFormModalProps } from "./maintenance-setting-form.types";
import { executionTypeLabels } from "./maintenance-settings-utils";
import { useMaintenanceSettingForm } from "./useMaintenanceSettingForm";

export type { MaintenanceSettingFormPayload } from "./maintenance-setting-form.types";

const executionTypeOptions = [
  { label: executionTypeLabels.INTERNAL, value: "INTERNAL" },
  { label: executionTypeLabels.EXTERNAL, value: "EXTERNAL" },
];

export function MaintenanceSettingFormModal({
  availableMaintenanceTypes,
  checklistTemplates,
  isSaving,
  mode,
  onClose,
  onSubmit,
  serverErrorCode = null,
  serverErrorMessage = null,
  setting = null,
}: MaintenanceSettingFormModalProps) {
  const form = useMaintenanceSettingForm({
    availableMaintenanceTypes,
    checklistTemplates,
    isSaving,
    mode,
    onSubmit,
    setting,
  });
  const fieldErrors = getFieldErrorsByCode(serverErrorCode);
  const title =
    mode === "edit" ? "Редактирование настройки" : "Назначить вид обслуживания";

  return (
    <AdminModal isCloseDisabled={isSaving} onClose={onClose} title={title}>
      <form
        className="admin-form maintenance-settings-form"
        onSubmit={form.handleSubmit}
      >
        {mode === "create" ? (
          <SelectDropdown
            error={fieldErrors.maintenanceTypeId}
            label="Вид обслуживания"
            onChange={form.updateMaintenanceTypeId}
            options={form.maintenanceTypeOptions}
            placeholder="Выберите вид обслуживания"
            required
            value={form.maintenanceTypeId}
          />
        ) : null}

        <SelectDropdown
          error={fieldErrors.defaultChecklistTemplateId}
          label="Шаблон чек-листа по умолчанию"
          onChange={form.updateDefaultChecklistTemplateId}
          options={form.checklistTemplateOptions}
          placeholder="Выберите шаблон"
          required={mode === "create"}
          value={form.defaultChecklistTemplateId}
        />

        <SelectDropdown
          error={fieldErrors.executionType}
          label="Способ выполнения"
          onChange={(value) =>
            form.updateExecutionType(value as MaintenanceExecutionType)
          }
          options={executionTypeOptions}
          required
          value={form.executionType}
        />

        <PeriodicityFields
          error={fieldErrors.periodicity}
          hasPeriodicity={form.hasPeriodicity}
          onHasPeriodicityChange={form.togglePeriodicity}
          onPresetApply={form.applyPeriodicityPreset}
          onValueChange={form.updatePeriodicity}
          value={form.periodicity}
        />

        {form.error || serverErrorMessage ? (
          <p className="admin-form-error">
            {form.error ?? serverErrorMessage}
          </p>
        ) : null}

        <AdminFormActions isSaving={isSaving} onClose={onClose} />
      </form>
    </AdminModal>
  );
}
