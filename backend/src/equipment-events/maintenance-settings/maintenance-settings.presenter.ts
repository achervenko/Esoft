import type {
  MaintenanceEventTypeRecord,
  MaintenanceSettingRecord,
  MaintenanceSettingsEquipmentRecord,
} from './maintenance-settings.relations';

export function presentMaintenanceSettings(
  equipment: MaintenanceSettingsEquipmentRecord,
  affectedEquipmentCount: number,
  settings: MaintenanceSettingRecord[],
) {
  return {
    affectedEquipmentCount,
    equipment: {
      name: equipment.name,
      visibleId: equipment.visibleId,
    },
    settings: settings.map(presentMaintenanceSetting),
  };
}

export function presentAvailableEventTypes(
  eventTypes: MaintenanceEventTypeRecord[],
) {
  return {
    eventTypes: eventTypes.map((eventType) => ({
      code: eventType.code,
      id: eventType.id,
      isActive: eventType.isActive,
      name: eventType.name,
    })),
  };
}

function presentMaintenanceSetting(setting: MaintenanceSettingRecord) {
  return {
    checklistTemplateId: setting.checklistTemplateId,
    eventType: {
      code: setting.eventType.code,
      id: setting.eventType.id,
      isActive: setting.eventType.isActive,
      name: setting.eventType.name,
    },
    executionType: setting.executionType,
    periodicity:
      setting.periodicityValue === null || setting.periodicityUnit === null
        ? null
        : {
            unit: setting.periodicityUnit,
            value: setting.periodicityValue,
          },
  };
}
