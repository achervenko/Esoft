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
        'Тип события',
        null,
        eventTypeLabel(params.setting),
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
        'Шаблон чек-листа',
        null,
        checklistLabel(params.setting),
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
      'Шаблон чек-листа',
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
        'Тип события',
        eventTypeLabel(params.setting),
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
        'Шаблон чек-листа',
        checklistLabel(params.setting),
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

export async function writeMaintenanceEventTypeCreatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    code: string;
    eventTypeId: number;
    name: string;
    userId?: string | null;
  },
) {
  await tx.auditLog.createMany({
    data: [
      {
        action: AuditAction.CREATE,
        entityId: params.eventTypeId,
        entityType: 'equipment_event_type',
        fieldName: 'Название типа события',
        module: AuditModule.EQUIPMENT,
        newValue: params.name,
        oldValue: null,
        userId: params.userId ?? null,
      },
      {
        action: AuditAction.CREATE,
        entityId: params.eventTypeId,
        entityType: 'equipment_event_type',
        fieldName: 'Код типа события',
        module: AuditModule.EQUIPMENT,
        newValue: params.code,
        oldValue: null,
        userId: params.userId ?? null,
      },
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
    entityId: params.equipment.modelId,
    entityType: 'equipment_maintenance_setting',
    fieldName: settingFieldName(params.setting, fieldName),
    module: AuditModule.EQUIPMENT,
    newValue: formatOperationValue(newValue),
    oldValue: action === AuditAction.CREATE ? null : formatOperationValue(oldValue),
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
    entityId: params.equipment.modelId,
    entityType: 'equipment_maintenance_setting',
    fieldName: settingFieldName(params.newSetting, fieldName),
    module: AuditModule.EQUIPMENT,
    newValue: formatNullableFieldValue(newValue),
    oldValue: formatNullableFieldValue(oldValue),
    userId: params.userId ?? null,
  };
}

function settingFieldName(setting: MaintenanceSettingRecord, fieldName: string) {
  return `${eventTypeLabel(setting)} — ${fieldName}`;
}

function eventTypeLabel(setting: MaintenanceSettingRecord) {
  return `${setting.eventType.name} [${setting.eventType.code}] #${setting.eventType.id}`;
}

function periodicityLabel(setting: MaintenanceSettingRecord) {
  if (setting.periodicityValue === null || setting.periodicityUnit === null) {
    return null;
  }

  return `${setting.periodicityValue} ${setting.periodicityUnit}`;
}

function checklistLabel(setting: MaintenanceSettingRecord) {
  return setting.checklistTemplateId === null
    ? null
    : `Шаблон #${setting.checklistTemplateId}`;
}

function formatOperationValue(value: unknown) {
  if (value === undefined || value === '') {
    return null;
  }

  return value === null ? null : String(value);
}

function formatNullableFieldValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'не указано';
  }

  return String(value);
}
