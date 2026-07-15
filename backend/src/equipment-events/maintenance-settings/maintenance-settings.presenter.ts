import type {
  MaintenanceSettingRecord,
  MaintenanceSettingsEquipmentRecord,
  MaintenanceTypeRecord,
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

export function presentAvailableMaintenanceTypes(
  maintenanceTypes: MaintenanceTypeRecord[],
) {
  return {
    maintenanceTypes: maintenanceTypes.map((maintenanceType) => ({
      id: maintenanceType.id,
      name: maintenanceType.name,
    })),
  };
}

function presentMaintenanceSetting(setting: MaintenanceSettingRecord) {
  return {
    checklistTemplateId: setting.checklistTemplateId,
    executionType: setting.executionType,
    id: setting.id,
    maintenanceType: {
      id: setting.maintenanceType.id,
      isActive: setting.maintenanceType.isActive,
      name: setting.maintenanceType.name,
    },
    periodicity: presentPeriodicity(setting),
  };
}

function presentPeriodicity(setting: MaintenanceSettingRecord) {
  if (
    setting.periodicityDays !== null &&
    setting.periodicityMonths !== null &&
    setting.periodicityWeeks !== null &&
    setting.periodicityYears !== null
  ) {
    return {
      years: setting.periodicityYears,
      months: setting.periodicityMonths,
      weeks: setting.periodicityWeeks,
      days: setting.periodicityDays,
    };
  }

  return null;
}
