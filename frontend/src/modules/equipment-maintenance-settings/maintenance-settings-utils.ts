import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
} from "../../shared/api/equipment-api";

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
