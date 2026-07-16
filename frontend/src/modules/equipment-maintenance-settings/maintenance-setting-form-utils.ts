import type {
  MaintenanceExecutionType,
  MaintenancePeriodicity,
  MaintenanceSetting,
  MaintenanceSettingChecklistTemplate,
  MaintenanceSettingChecklistTemplatePayload,
  MaintenanceSettingUpdatePayload,
} from "../../shared/api/maintenance/maintenance.types";

export type PeriodicityForm = {
  years: string;
  months: string;
  weeks: string;
  days: string;
};

export type MaintenanceSettingUpdateSource = {
  checklistTemplates: MaintenanceSettingChecklistTemplatePayload[];
  executionType: MaintenanceExecutionType;
  periodicity: MaintenancePeriodicity | null;
};

export type ChecklistTemplateFormItem = {
  clientId: string;
  checklistTemplateId: string;
  isRequired: boolean;
};

export type ParseChecklistTemplatesResult =
  | { ok: true; value: MaintenanceSettingChecklistTemplatePayload[] }
  | { ok: false; reason: "duplicate" | "invalid-id" };

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

function parsePositiveInteger(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(trimmedValue)) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isSafeInteger(parsedValue) ? parsedValue : undefined;
}

export function toChecklistTemplateFormItems(
  checklistTemplates: MaintenanceSettingChecklistTemplate[] = [],
): ChecklistTemplateFormItem[] {
  return [...checklistTemplates]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.checklistTemplateId - right.checklistTemplateId,
    )
    .map((template) => ({
      checklistTemplateId: String(template.checklistTemplateId),
      clientId: String(template.checklistTemplateId),
      isRequired: template.isRequired,
    }));
}

export function createEmptyChecklistTemplateFormItem(
  index: number,
): ChecklistTemplateFormItem {
  return {
    checklistTemplateId: "",
    clientId: `new-${Date.now()}-${index}`,
    isRequired: true,
  };
}

export function parseChecklistTemplateFormItems(
  items: ChecklistTemplateFormItem[],
): ParseChecklistTemplatesResult {
  const checklistTemplateIds = new Set<number>();
  const checklistTemplates: MaintenanceSettingChecklistTemplatePayload[] = [];

  for (const [index, item] of items.entries()) {
    const checklistTemplateId = parsePositiveInteger(item.checklistTemplateId);

    if (checklistTemplateId === undefined) {
      return { ok: false, reason: "invalid-id" };
    }

    if (checklistTemplateIds.has(checklistTemplateId)) {
      return { ok: false, reason: "duplicate" };
    }

    checklistTemplateIds.add(checklistTemplateId);
    checklistTemplates.push({
      checklistTemplateId,
      isRequired: item.isRequired,
      sortOrder: index + 1,
    });
  }

  return { ok: true, value: checklistTemplates };
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
    !areChecklistTemplatePayloadsEqual(
      setting.checklistTemplates,
      payload.checklistTemplates,
    )
  ) {
    updatePayload.checklistTemplates = payload.checklistTemplates;
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

function areChecklistTemplatePayloadsEqual(
  left: MaintenanceSettingChecklistTemplate[],
  right: MaintenanceSettingChecklistTemplatePayload[],
) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder ||
      first.checklistTemplateId - second.checklistTemplateId,
  );
  const sortedRight = [...right].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder ||
      first.checklistTemplateId - second.checklistTemplateId,
  );

  return sortedLeft.every((leftItem, index) => {
    const rightItem = sortedRight[index];

    return (
      leftItem.checklistTemplateId === rightItem.checklistTemplateId &&
      leftItem.isRequired === rightItem.isRequired &&
      leftItem.sortOrder === rightItem.sortOrder
    );
  });
}
