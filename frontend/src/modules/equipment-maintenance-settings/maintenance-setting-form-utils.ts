import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";

export type PeriodicityForm = {
  years: string;
  months: string;
  weeks: string;
  days: string;
};

export type MaintenanceSettingUpdateSource = {
  defaultChecklistTemplateId?: number | null;
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
};

export type ParseDefaultChecklistTemplateIdResult =
  | { ok: true; value: number | null }
  | { ok: false };

export type ParsePeriodicityResult =
  | { ok: true; value: MaintenancePeriodicity | null }
  | { ok: false; reason: "empty" | "invalid-number" };

export const emptyPeriodicityForm: PeriodicityForm = {
  years: "",
  months: "",
  weeks: "",
  days: "",
};

export function toPeriodicityForm(
  periodicity: MaintenancePeriodicity | null,
): PeriodicityForm {
  return {
    years: periodicity?.years ? String(periodicity.years) : "",
    months: periodicity?.months ? String(periodicity.months) : "",
    weeks: periodicity?.weeks ? String(periodicity.weeks) : "",
    days: periodicity?.days ? String(periodicity.days) : "",
  };
}

export function parseDefaultChecklistTemplateId(
  value: string,
): ParseDefaultChecklistTemplateIdResult {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { ok: true, value: null };
  }

  if (!/^[1-9]\d*$/.test(trimmedValue)) {
    return { ok: false };
  }

  const parsedValue = Number(trimmedValue);

  return Number.isSafeInteger(parsedValue)
    ? { ok: true, value: parsedValue }
    : { ok: false };
}

export function parsePeriodicityForm(
  shouldUsePeriodicity: boolean,
  value: PeriodicityForm,
): ParsePeriodicityResult {
  if (!shouldUsePeriodicity) {
    return { ok: true, value: null };
  }

  const parsedPeriodicity = {
    years: parseNonNegativeInteger(value.years),
    months: parseNonNegativeInteger(value.months),
    weeks: parseNonNegativeInteger(value.weeks),
    days: parseNonNegativeInteger(value.days),
  };

  if (Object.values(parsedPeriodicity).some((item) => item === undefined)) {
    return { ok: false, reason: "invalid-number" };
  }

  if (
    parsedPeriodicity.years === 0 &&
    parsedPeriodicity.months === 0 &&
    parsedPeriodicity.weeks === 0 &&
    parsedPeriodicity.days === 0
  ) {
    return { ok: false, reason: "empty" };
  }

  return {
    ok: true,
    value: parsedPeriodicity as MaintenancePeriodicity,
  };
}

export function buildMaintenanceSettingUpdatePayload(
  setting: MaintenanceSetting,
  payload: MaintenanceSettingUpdateSource,
): MaintenanceSettingUpdatePayload {
  const updatePayload: MaintenanceSettingUpdatePayload = {};

  if (
    payload.defaultChecklistTemplateId !== undefined &&
    setting.defaultChecklistTemplate?.checklistTemplateId !==
      payload.defaultChecklistTemplateId
  ) {
    updatePayload.defaultChecklistTemplateId = payload.defaultChecklistTemplateId;
  }

  if (setting.executionType !== payload.executionType) {
    updatePayload.executionType = payload.executionType;
  }

  if (!arePeriodicityValuesEqual(setting.periodicity, payload.periodicity)) {
    updatePayload.periodicity = payload.periodicity;
  }

  return updatePayload;
}

export function arePeriodicityValuesEqual(
  left: MaintenancePeriodicity | null,
  right: MaintenancePeriodicity | null,
) {
  if (left === null || right === null) {
    return left === right;
  }

  return (
    left.years === right.years &&
    left.months === right.months &&
    left.weeks === right.weeks &&
    left.days === right.days
  );
}

function parseNonNegativeInteger(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  if (!/^(0|[1-9]\d*)$/.test(trimmedValue)) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isSafeInteger(parsedValue) ? parsedValue : undefined;
}
