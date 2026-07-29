import { Prisma } from '@prisma/client';

const equipmentListSelect = {
  id: true,
  model: {
    select: {
      id: true,
      name: true,
    },
  },
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

const equipmentDetailSelect = {
  id: true,
  model: {
    select: {
      id: true,
      manufacturer: {
        select: {
          id: true,
          name: true,
        },
      },
      name: true,
    },
  },
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

const eventTypeResponseSelect = {
  code: true,
  id: true,
  name: true,
} satisfies Prisma.EquipmentEventTypeSelect;

export const equipmentEventExtensionListSelect = {
  equipment: {
    select: equipmentListSelect,
  },
  eventType: {
    select: eventTypeResponseSelect,
  },
  executionType: true,
  maintenanceSettingId: true,
} satisfies Prisma.EquipmentEventExtensionSelect;

export const equipmentEventExtensionDetailSelect = {
  equipment: {
    select: equipmentDetailSelect,
  },
  eventType: {
    select: eventTypeResponseSelect,
  },
  executionType: true,
  maintenanceSettingId: true,
} satisfies Prisma.EquipmentEventExtensionSelect;

export type EquipmentEventExtensionListRecord =
  Prisma.EquipmentEventExtensionGetPayload<{
    select: typeof equipmentEventExtensionListSelect;
  }>;

export type EquipmentEventExtensionDetailRecord =
  Prisma.EquipmentEventExtensionGetPayload<{
    select: typeof equipmentEventExtensionDetailSelect;
  }>;
