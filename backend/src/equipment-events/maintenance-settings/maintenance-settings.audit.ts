import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type {
  MaintenanceSettingRecord,
  MaintenanceSettingsEquipmentRecord,
} from './maintenance-settings.relations';

type MaintenanceSettingAuditContext = {
  affectedEquipmentCount: number;
  equipment: MaintenanceSettingsEquipmentRecord;
  setting: MaintenanceSettingRecord;
  userId?: string | null;
};

type MaintenanceSettingUpdateAuditContext = {
  equipment: MaintenanceSettingsEquipmentRecord;
  newSetting: MaintenanceSettingRecord;
  oldSetting: MaintenanceSettingRecord;
  userId?: string | null;
};

type MaintenanceSettingDeleteAuditContext = {
  affectedEquipmentCount: number;
  equipment: MaintenanceSettingsEquipmentRecord;
  setting: MaintenanceSettingRecord;
  userId?: string | null;
};

export async function writeMaintenanceSettingCreatedAudit(
  tx: Prisma.TransactionClient,
  params: MaintenanceSettingAuditContext,
) {
  await tx.auditLog.createMany({
    data: [
      auditLine(
        params,
        AuditAction.CREATE,
        'Вид обслуживания',
        null,
        maintenanceTypeLabel(params.setting),
      ),
      auditLine(
        params,
        AuditAction.CREATE,
        'Способ выполнения',
        null,
        params.setting.executionType,
      ),
      auditLine(
        params,
        AuditAction.CREATE,
        'Периодичность',
        null,
        periodicityLabel(params.setting),
      ),
      auditLine(
        params,
        AuditAction.CREATE,
        'Шаблон чек-листа по умолчанию',
        null,
        checklistLabel(params.setting),
      ),
      auditLine(
        params,
        AuditAction.CREATE,
        'Оборудование',
        null,
        params.equipment.name,
      ),
      auditLine(
        params,
        AuditAction.CREATE,
        'Оборудования этой модели',
        null,
        params.affectedEquipmentCount,
      ),
    ],
  });
}

export async function writeMaintenanceSettingUpdatedAudit(
  tx: Prisma.TransactionClient,
  params: MaintenanceSettingUpdateAuditContext,
) {
  const lines = [
    comparisonLine(
      params,
      'Способ выполнения',
      params.oldSetting.executionType,
      params.newSetting.executionType,
    ),
    comparisonLine(
      params,
      'Периодичность',
      periodicityLabel(params.oldSetting),
      periodicityLabel(params.newSetting),
    ),
    comparisonLine(
      params,
      'Шаблон чек-листа по умолчанию',
      checklistLabel(params.oldSetting),
      checklistLabel(params.newSetting),
    ),
  ].filter((line) => line.oldValue !== line.newValue);

  if (lines.length === 0) {
    return;
  }

  await tx.auditLog.createMany({ data: lines });
}

export async function writeMaintenanceSettingDeletedAudit(
  tx: Prisma.TransactionClient,
  params: MaintenanceSettingDeleteAuditContext,
) {
  await tx.auditLog.createMany({
    data: [
      auditLine(
        params,
        AuditAction.DELETE,
        'Вид обслуживания',
        maintenanceTypeLabel(params.setting),
        null,
      ),
      auditLine(
        params,
        AuditAction.DELETE,
        'Способ выполнения',
        params.setting.executionType,
        null,
      ),
      auditLine(
        params,
        AuditAction.DELETE,
        'Периодичность',
        periodicityLabel(params.setting),
        null,
      ),
      auditLine(
        params,
        AuditAction.DELETE,
        'Шаблон чек-листа по умолчанию',
        checklistLabel(params.setting),
        null,
      ),
      auditLine(
        params,
        AuditAction.DELETE,
        'Оборудование',
        params.equipment.name,
        null,
      ),
      auditLine(
        params,
        AuditAction.DELETE,
        'Оборудования этой модели',
        params.affectedEquipmentCount,
        null,
      ),
    ],
  });
}

function auditLine(
  params: MaintenanceSettingAuditContext | MaintenanceSettingDeleteAuditContext,
  action: AuditAction,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  return {
    action,
    entityId: params.setting.id,
    entityType: 'equipment_maintenance_setting',
    fieldName: settingFieldName(params.setting, fieldName),
    module: AuditModule.EQUIPMENT,
    newValue: formatOperationValue(newValue),
    oldValue:
      action === AuditAction.CREATE ? null : formatOperationValue(oldValue),
    userId: params.userId ?? null,
  };
}

function comparisonLine(
  params: MaintenanceSettingUpdateAuditContext,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  return {
    action: AuditAction.UPDATE,
    entityId: params.newSetting.id,
    entityType: 'equipment_maintenance_setting',
    fieldName: settingFieldName(params.newSetting, fieldName),
    module: AuditModule.EQUIPMENT,
    newValue: formatNullableFieldValue(newValue),
    oldValue: formatNullableFieldValue(oldValue),
    userId: params.userId ?? null,
  };
}

function settingFieldName(
  setting: MaintenanceSettingRecord,
  fieldName: string,
) {
  return `${maintenanceTypeLabel(setting)} — ${fieldName}`;
}

function maintenanceTypeLabel(setting: MaintenanceSettingRecord) {
  return `${setting.maintenanceType.name} #${setting.maintenanceType.id}`;
}

function periodicityLabel(setting: MaintenanceSettingRecord) {
  if (
    setting.periodicityYears === null &&
    setting.periodicityMonths === null &&
    setting.periodicityWeeks === null &&
    setting.periodicityDays === null
  ) {
    return null;
  }

  const value = [
    durationPart(setting.periodicityYears ?? 0, ['год', 'года', 'лет']),
    durationPart(setting.periodicityMonths ?? 0, [
      'месяц',
      'месяца',
      'месяцев',
    ]),
    durationPart(setting.periodicityWeeks ?? 0, ['неделя', 'недели', 'недель']),
    durationPart(setting.periodicityDays ?? 0, ['день', 'дня', 'дней']),
  ]
    .filter(Boolean)
    .join(' ');

  return value || null;
}

function durationPart(value: number, forms: [string, string, string]) {
  if (value === 0) {
    return null;
  }

  return `${value} ${pluralizeRu(value, forms)}`;
}

function pluralizeRu(
  value: number,
  [one, few, many]: [string, string, string],
) {
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

function checklistLabel(setting: MaintenanceSettingRecord) {
  if (
    !setting.defaultChecklistTemplateId ||
    !setting.defaultChecklistTemplate
  ) {
    return null;
  }

  return [
    `Шаблон #${setting.defaultChecklistTemplate.id}`,
    setting.defaultChecklistTemplate.name,
    setting.defaultChecklistTemplate.isActive &&
    setting.defaultChecklistTemplate.isPublished
      ? 'ACTIVE'
      : 'ARCHIVED',
  ].join(', ');
}

function formatOperationValue(value: unknown) {
  if (value === undefined || value === '') {
    return null;
  }

  return value === null ? null : stringifyAuditValue(value);
}

function formatNullableFieldValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'не указано';
  }

  return stringifyAuditValue(value);
}

function stringifyAuditValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value.toString();
  }

  const serialized = JSON.stringify(value);

  return serialized ?? String(value);
}
