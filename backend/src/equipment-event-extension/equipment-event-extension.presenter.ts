import { EventExtensionCode } from '@prisma/client';
import type {
  EquipmentEventExtensionDetailRecord,
  EquipmentEventExtensionListRecord,
} from './equipment-event-extension.relations';
import type {
  EquipmentEventExtensionDetailResponse,
  EquipmentEventExtensionListResponse,
} from './equipment-event-extension.presenter.types';

export function toEquipmentEventExtensionListResponse(
  extension: EquipmentEventExtensionListRecord,
): EquipmentEventExtensionListResponse {
  return {
    code: EventExtensionCode.EQUIPMENT,
    maintenanceSettingId: extension.maintenanceSettingId,
    executionType: extension.executionType,
    equipment: {
      ...extension.equipment,
      location: formatEquipmentLocation(extension.equipment.section),
    },
    maintenanceType: toMaintenanceTypeResponse(extension),
  };
}

export function toEquipmentEventExtensionDetailResponse(
  extension: EquipmentEventExtensionDetailRecord,
): EquipmentEventExtensionDetailResponse {
  return {
    code: EventExtensionCode.EQUIPMENT,
    maintenanceSettingId: extension.maintenanceSettingId,
    executionType: extension.executionType,
    equipment: extension.equipment,
    maintenanceType: toMaintenanceTypeResponse(extension),
  };
}

function toMaintenanceTypeResponse(
  extension:
    EquipmentEventExtensionListRecord | EquipmentEventExtensionDetailRecord,
) {
  return {
    id: extension.eventType.id,
    name: extension.eventType.name,
    code: extension.eventType.code,
  };
}

function formatEquipmentLocation(
  section: EquipmentEventExtensionListRecord['equipment']['section'],
) {
  return [section.workshop.name, section.name].filter(Boolean).join(' / ');
}
