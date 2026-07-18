import { EquipmentMaintenanceExecutionType } from '@prisma/client';

export type MaintenanceBaseSettingInput = {
  defaultChecklistTemplateId: number | null;
  executionType: EquipmentMaintenanceExecutionType;
  periodicity: PeriodicityInput | null;
};

export type MaintenanceSettingInput = MaintenanceBaseSettingInput & {
  maintenanceTypeId: number;
};

export type MaintenanceSettingUpdateInput = {
  defaultChecklistTemplateId?: number | null;
  executionType?: EquipmentMaintenanceExecutionType;
  periodicity?: PeriodicityInput | null;
};

export type PeriodicityInput = {
  years: number;
  months: number;
  weeks: number;
  days: number;
};
