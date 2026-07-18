import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type {
  MaintenanceType,
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
  MaintenanceSettingChecklistTemplatePayload,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";

export type MaintenanceSettingFormMode = "create" | "edit";

export type MaintenanceSettingFormPayload = {
  checklistTemplates: MaintenanceSettingChecklistTemplatePayload[];
  maintenanceTypeId?: number;
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
  updatePayload?: MaintenanceSettingUpdatePayload;
};

export type MaintenanceSettingFormModalProps = {
  availableMaintenanceTypes: MaintenanceType[];
  checklistTemplates: ChecklistTemplateListItem[];
  isSaving: boolean;
  mode: MaintenanceSettingFormMode;
  onClose: () => void;
  onSubmit: (payload: MaintenanceSettingFormPayload) => void;
  serverErrorCode?: string | null;
  setting?: MaintenanceSetting | null;
};
