import { EventExtensionCode, Prisma } from '@prisma/client';
import type {
  EventChecklistRecord,
  EventDetailRecord,
  EventListRecord,
} from '../events/events.relations';

export const equipmentEventAuditSelect = {
  equipmentExtension: {
    select: {
      equipment: {
        select: {
          name: true,
          visibleId: true,
        },
      },
      eventType: {
        select: {
          code: true,
          id: true,
          name: true,
        },
      },
      executionType: true,
      maintenanceSettingId: true,
    },
  },
  extensionCode: true,
  id: true,
} satisfies Prisma.EventSelect;

export type EquipmentEventListRecord = EventListRecord;

export type EquipmentEventDetailRecord = EventDetailRecord;

export type EquipmentEventChecklistRecord = EventChecklistRecord;

export type EquipmentEventListRecordWithExtension = EquipmentEventListRecord & {
  extensionCode: typeof EventExtensionCode.EQUIPMENT;
  equipmentExtension: NonNullable<
    EquipmentEventListRecord['equipmentExtension']
  >;
};

export type EquipmentEventDetailRecordWithExtension =
  EquipmentEventDetailRecord & {
    extensionCode: typeof EventExtensionCode.EQUIPMENT;
    equipmentExtension: NonNullable<
      EquipmentEventDetailRecord['equipmentExtension']
    >;
  };
