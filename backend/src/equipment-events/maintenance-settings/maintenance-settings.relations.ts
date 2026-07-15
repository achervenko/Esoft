import { Prisma } from '@prisma/client';

export const maintenanceSettingsEquipmentSelect = {
  id: true,
  modelId: true,
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

export const maintenanceSettingsEventTypeSelect = {
  code: true,
  id: true,
  isActive: true,
  name: true,
} satisfies Prisma.EquipmentEventTypeSelect;

export const maintenanceSettingSelect = {
  checklistTemplateId: true,
  eventType: {
    select: maintenanceSettingsEventTypeSelect,
  },
  executionType: true,
  periodicityUnit: true,
  periodicityValue: true,
} satisfies Prisma.EquipmentModelEventTypeSelect;

export type MaintenanceSettingsEquipmentRecord = Prisma.EquipmentGetPayload<{
  select: typeof maintenanceSettingsEquipmentSelect;
}>;

export type MaintenanceSettingRecord = Prisma.EquipmentModelEventTypeGetPayload<{
  select: typeof maintenanceSettingSelect;
}>;

export type MaintenanceEventTypeRecord = Prisma.EquipmentEventTypeGetPayload<{
  select: typeof maintenanceSettingsEventTypeSelect;
}>;
