import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSettingsResponse,
  MaintenanceType,
} from "../../shared/api/maintenance/maintenance.types";

export const executionTypeLabels: Record<MaintenanceExecutionType, string> = {
  EXTERNAL: "Внешнее",
  INTERNAL: "Внутреннее",
};

export function formatMaintenancePeriodicity(
  periodicity: MaintenancePeriodicity | null,
) {
  if (!periodicity) {
    return "Не задана";
  }

  const parts = [
    durationPart(periodicity.years, ["год", "года", "лет"]),
    durationPart(periodicity.months, ["месяц", "месяца", "месяцев"]),
    durationPart(periodicity.weeks, ["неделя", "недели", "недель"]),
    durationPart(periodicity.days, ["день", "дня", "дней"]),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Не задана";
}

function durationPart(value: number, forms: [string, string, string]) {
  if (value === 0) {
    return null;
  }

  return `${value} ${pluralizeRu(value, forms)}`;
}

export function reconcileAvailableMaintenanceTypes(
  currentAvailableTypes: MaintenanceType[],
  nextSettingsResponse: MaintenanceSettingsResponse,
  previousSettingsResponse: MaintenanceSettingsResponse | null,
) {
  const typeById = new Map<number, MaintenanceType>();

  for (const maintenanceType of currentAvailableTypes) {
    typeById.set(maintenanceType.id, maintenanceType);
  }

  for (const setting of previousSettingsResponse?.settings ?? []) {
    typeById.set(setting.maintenanceType.id, setting.maintenanceType);
  }

  for (const setting of nextSettingsResponse.settings) {
    typeById.set(setting.maintenanceType.id, setting.maintenanceType);
  }

  const assignedTypeIds = new Set(
    nextSettingsResponse.settings.map((setting) => setting.maintenanceType.id),
  );

  return Array.from(typeById.values())
    .filter(
      (maintenanceType) =>
        !assignedTypeIds.has(maintenanceType.id) &&
        maintenanceType.isActive !== false,
    )
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

function pluralizeRu(value: number, [one, few, many]: [string, string, string]) {
  const lastTwoDigits = value % 100;
  const lastDigit = value % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return many;
  }

  if (lastDigit === 1) {
    return one;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }

  return many;
}
