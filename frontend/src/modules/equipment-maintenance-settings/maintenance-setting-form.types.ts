import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type {
  MaintenanceType,
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";

export type MaintenanceSettingFormMode = "create" | "edit";

export type MaintenanceSettingCreateFormPayload = {
  defaultChecklistTemplateId: number;
  executionType: MaintenanceExecutionType;
  maintenanceTypeId: number;
  mode: "create";
  periodicity: MaintenancePeriodicity | null;
};

export type MaintenanceSettingEditFormPayload = {
  executionType: MaintenanceExecutionType;
  mode: "edit";
  periodicity: MaintenancePeriodicity | null;
  updatePayload: MaintenanceSettingUpdatePayload;
};

export type MaintenanceSettingFormPayload =
  | MaintenanceSettingCreateFormPayload
  | MaintenanceSettingEditFormPayload;

export type MaintenanceSettingFormModalProps = {
  availableMaintenanceTypes: MaintenanceType[];
  checklistTemplates: ChecklistTemplateListItem[];
  isSaving: boolean;
  mode: MaintenanceSettingFormMode;
  onClose: () => void;
  onSubmit: (payload: MaintenanceSettingFormPayload) => void;
  serverErrorCode?: string | null;
  serverErrorMessage?: string | null;
  setting?: MaintenanceSetting | null;
};
