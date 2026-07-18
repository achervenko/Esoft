import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { EquipmentEventChecklistAssignments } from "./EquipmentEventChecklistAssignments";
import { EquipmentEventResponsibleFields } from "./EquipmentEventResponsibleFields";
import type {
  EquipmentEventFormMode,
  EquipmentEventFormPayload,
  ResponsibleUserOption,
} from "./equipment-event-form.types";
import { useEquipmentEventForm } from "./useEquipmentEventForm";

export type { EquipmentEventFormPayload } from "./equipment-event-form.types";

type EquipmentEventFormModalProps = {
  error?: string | null;
  checklistTemplates: ChecklistTemplateListItem[];
  users: ResponsibleUserOption[];
  event?: EquipmentEventItem | null;
  isSaving: boolean;
  maintenanceSettings: MaintenanceSetting[];
  mode: EquipmentEventFormMode;
  onClose: () => void;
  onSubmit: (payload: EquipmentEventFormPayload) => void;
};

export function EquipmentEventFormModal({
  error: serverError = null,
  checklistTemplates,
  users,
  event = null,
  isSaving,
  maintenanceSettings,
  mode,
  onClose,
  onSubmit,
}: EquipmentEventFormModalProps) {
  const form = useEquipmentEventForm({
    event,
    equipmentVisibleId: event?.equipment.visibleId,
    isSaving,
    maintenanceSettings,
    mode,
    onSubmit,
    users,
  });

  return (
    <AdminModal
      className="equipment-event-form-modal"
      onClose={onClose}
      title={mode === "edit" ? "Редактирование события" : "Назначить событие"}
    >
      <form
        className="admin-form equipment-event-form"
        onSubmit={form.handleSubmit}
      >
        <SelectDropdown
          label="Вид обслуживания"
          onChange={form.setMaintenanceTypeId}
          options={form.maintenanceTypeOptions}
          placeholder="Выберите вид обслуживания"
          required
          value={form.maintenanceTypeId}
        />

        <label className="form-field">
          <span>
            Плановая дата<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(inputEvent) =>
              form.setPlannedDate(inputEvent.target.value)
            }
            type="date"
            value={form.plannedDate}
          />
        </label>

        <EquipmentEventResponsibleFields
          onToggle={form.toggleResponsible}
          responsibleUserIds={form.responsibleUserIds}
          users={form.responsibleOptions}
        />

        <EquipmentEventChecklistAssignments
          checklistTemplateIdByResponsible={form.checklistTemplateIdsByResponsible}
          checklistTemplateOptions={checklistTemplates}
          onAssign={form.assignChecklistTemplate}
          responsibleUserIds={form.responsibleUserIds}
          users={form.responsibleOptions}
        />

        <label className="form-field">
          <span>Комментарий</span>
          <textarea
            onChange={(inputEvent) => form.setNote(inputEvent.target.value)}
            placeholder="Комментарий к событию"
            rows={4}
            value={form.note}
          />
        </label>

        {form.error || serverError ? (
          <p className="admin-form-error">{form.error ?? serverError}</p>
        ) : null}

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
