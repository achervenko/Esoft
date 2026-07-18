export type CreateMaintenanceSettingDto = {
  defaultChecklistTemplateId?: unknown;
  executionType?: unknown;
  maintenanceTypeId?: unknown;
  periodicity?: unknown;
};

export type UpdateMaintenanceSettingDto = {
  defaultChecklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
};

export type MaintenanceSettingBaseDto = {
  defaultChecklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
};
