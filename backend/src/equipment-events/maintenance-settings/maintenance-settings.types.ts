import { EquipmentMaintenanceExecutionType } from '@prisma/client';

export type MaintenanceBaseSettingInput = {
  checklistTemplates: MaintenanceSettingChecklistTemplateInput[];
  executionType: EquipmentMaintenanceExecutionType;
  periodicity: PeriodicityInput | null;
};

export type MaintenanceSettingInput = MaintenanceBaseSettingInput & {
  maintenanceTypeId: number;
};

export type MaintenanceSettingUpdateInput = {
  checklistTemplates?: MaintenanceSettingChecklistTemplateInput[];
  executionType?: EquipmentMaintenanceExecutionType;
  periodicity?: PeriodicityInput | null;
};

export type MaintenanceSettingChecklistTemplateInput = {
  checklistTemplateId: number;
  isRequired: boolean;
  sortOrder: number;
};

export type PeriodicityInput = {
  years: number;
  months: number;
  weeks: number;
  days: number;
};
