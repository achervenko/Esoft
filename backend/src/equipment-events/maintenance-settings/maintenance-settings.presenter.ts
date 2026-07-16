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
    checklistTemplates: presentChecklistTemplates(setting),
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

function presentChecklistTemplates(setting: MaintenanceSettingRecord) {
  return [...setting.checklistTemplateLinks]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.checklistTemplateId - right.checklistTemplateId,
    )
    .map((link) => ({
      checklistTemplateId: link.checklistTemplateId,
      name: link.checklistTemplate.name,
      isRequired: link.isRequired,
      sortOrder: link.sortOrder,
    }));
}

function presentPeriodicity(setting: MaintenanceSettingRecord) {
  if (
    setting.periodicityDays === null &&
    setting.periodicityMonths === null &&
    setting.periodicityWeeks === null &&
    setting.periodicityYears === null
  ) {
    return null;
  }

  return {
    years: setting.periodicityYears ?? 0,
    months: setting.periodicityMonths ?? 0,
    weeks: setting.periodicityWeeks ?? 0,
    days: setting.periodicityDays ?? 0,
  };
}
