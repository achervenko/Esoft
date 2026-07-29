import { EventExtensionCode } from '@prisma/client';
import type {
  EventChecklistRecord,
  EventDetailRecord,
  EventListRecord,
} from '../events/events.relations';

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
