import type { MaintenanceExecutionType } from "../../shared/api/maintenance/maintenance.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { MaintenanceChecklistTemplatesField } from "./MaintenanceChecklistTemplatesField";
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
  isSaving,
  mode,
  onClose,
  onSubmit,
  serverErrorCode = null,
  setting = null,
}: MaintenanceSettingFormModalProps) {
  const form = useMaintenanceSettingForm({
    availableMaintenanceTypes,
    isSaving,
    mode,
    onSubmit,
    setting,
  });
  const fieldErrors = getFieldErrorsByCode(serverErrorCode);
  const title =
    mode === "edit" ? "Редактирование настройки" : "Назначить вид обслуживания";

  return (
    <AdminModal onClose={onClose} title={title}>
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
          error={fieldErrors.executionType}
          label="Способ выполнения"
          onChange={(value) =>
            form.updateExecutionType(value as MaintenanceExecutionType)
          }
          options={executionTypeOptions}
          required
          value={form.executionType}
        />

        <MaintenanceChecklistTemplatesField
          error={fieldErrors.checklistTemplates}
          items={form.checklistTemplates}
          onAdd={form.addChecklistTemplate}
          onMove={form.moveChecklistTemplate}
          onRemove={form.removeChecklistTemplate}
          onUpdate={form.updateChecklistTemplate}
        />

        <PeriodicityFields
          error={fieldErrors.periodicity}
          hasPeriodicity={form.hasPeriodicity}
          onHasPeriodicityChange={form.togglePeriodicity}
          onPresetApply={form.applyPeriodicityPreset}
          onValueChange={form.updatePeriodicity}
          value={form.periodicity}
        />

        {form.error ? <p className="admin-form-error">{form.error}</p> : null}

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
