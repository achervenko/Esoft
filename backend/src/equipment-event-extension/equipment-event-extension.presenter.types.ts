import { EventExtensionCode } from '@prisma/client';
import type {
  EquipmentEventExtensionDetailRecord,
  EquipmentEventExtensionListRecord,
} from './equipment-event-extension.relations';

export type EquipmentEventExtensionRecord =
  EquipmentEventExtensionListRecord | EquipmentEventExtensionDetailRecord;

type EquipmentEventExtensionBaseResponse = {
  code: typeof EventExtensionCode.EQUIPMENT;
  maintenanceSettingId: number;
  executionType: EquipmentEventExtensionRecord['executionType'];
  maintenanceType: {
    code: string;
    id: number;
    name: string;
  };
};

export type EquipmentEventExtensionListResponse =
  EquipmentEventExtensionBaseResponse & {
    equipment: EquipmentEventExtensionListRecord['equipment'] & {
      location: string;
    };
  };

export type EquipmentEventExtensionDetailResponse =
  EquipmentEventExtensionBaseResponse & {
    equipment: EquipmentEventExtensionDetailRecord['equipment'];
  };
