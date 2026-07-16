import { Prisma } from '@prisma/client';

export const maintenanceSettingsEquipmentSelect = {
  id: true,
  modelId: true,
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

export const maintenanceSettingsMaintenanceTypeSelect = {
  id: true,
  isActive: true,
  name: true,
} satisfies Prisma.EquipmentEventTypeSelect;

export const maintenanceSettingSelect = {
  checklistTemplateLinks: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      checklistTemplate: {
        select: {
          name: true,
        },
      },
      checklistTemplateId: true,
      id: true,
      isRequired: true,
      sortOrder: true,
    },
  },
  executionType: true,
  id: true,
  maintenanceType: {
    select: maintenanceSettingsMaintenanceTypeSelect,
  },
  periodicityDays: true,
  periodicityMonths: true,
  periodicityWeeks: true,
  periodicityYears: true,
} satisfies Prisma.EquipmentMaintenanceSettingSelect;

export type MaintenanceSettingsEquipmentRecord = Prisma.EquipmentGetPayload<{
  select: typeof maintenanceSettingsEquipmentSelect;
}>;

export type MaintenanceSettingRecord =
  Prisma.EquipmentMaintenanceSettingGetPayload<{
    select: typeof maintenanceSettingSelect;
  }>;

export type MaintenanceTypeRecord = Prisma.EquipmentEventTypeGetPayload<{
  select: typeof maintenanceSettingsMaintenanceTypeSelect;
}>;
