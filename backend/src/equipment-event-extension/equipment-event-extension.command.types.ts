import { type EquipmentMaintenanceExecutionType } from '@prisma/client';

export type EquipmentEventExtensionCreateInput = {
  equipmentVisibleId: number;
  maintenanceTypeId: number;
};

export type PreparedEquipmentEventExtensionCreate = {
  equipmentId: number;
  eventTypeId: number;
  maintenanceSettingId: number;
  executionType: EquipmentMaintenanceExecutionType;
};

export type EquipmentEventExtensionUpdateInput = {
  equipmentVisibleId?: number;
  maintenanceTypeId?: number;
};

export type PreparedEquipmentEventExtensionUpdate = {
  equipmentId?: number;
  eventTypeId?: number;
  finalMaintenanceSettingId: number;
  maintenanceSetting?: {
    executionType: EquipmentMaintenanceExecutionType;
    id: number;
  };
};
