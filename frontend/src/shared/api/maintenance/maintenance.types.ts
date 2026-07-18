export type MaintenancePeriodicity = {
  years: number;
  months: number;
  weeks: number;
  days: number;
};

export type MaintenanceExecutionType = "INTERNAL" | "EXTERNAL";

export type MaintenanceType = {
  code?: string;
  id: number;
  isActive?: boolean;
  name: string;
};

export type MaintenanceSettingDefaultChecklistTemplate = {
  checklistTemplateId: number;
  name: string;
  state: "ACTIVE" | "ARCHIVED";
};

export type MaintenanceSetting = {
  defaultChecklistTemplate: MaintenanceSettingDefaultChecklistTemplate | null;
  executionType: MaintenanceExecutionType;
  id: number;
  maintenanceType: {
    id: number;
    isActive: boolean;
    name: string;
  };
  periodicity: MaintenancePeriodicity | null;
};

export type MaintenanceSettingsResponse = {
  affectedEquipmentCount: number;
  equipment: {
    name: string;
    visibleId: number;
  };
  settings: MaintenanceSetting[];
};

export type AvailableMaintenanceTypesResponse = {
  maintenanceTypes: MaintenanceType[];
};

export type MaintenanceSettingBasePayload = {
  defaultChecklistTemplateId?: number | null;
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
};

export type MaintenanceSettingPayload = MaintenanceSettingBasePayload & {
  maintenanceTypeId: number;
};

export type MaintenanceSettingUpdatePayload = {
  defaultChecklistTemplateId?: number | null;
  executionType?: MaintenanceExecutionType;
  periodicity?: MaintenancePeriodicity | null;
};
