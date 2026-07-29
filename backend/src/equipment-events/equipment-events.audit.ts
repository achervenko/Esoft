import {
  AuditAction,
  AuditModule,
  EventExtensionCode,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { throwEquipmentEventNotFound } from './equipment-events.errors';
import { equipmentEventAuditSelect } from './equipment-events.relations';

export type EquipmentEventAuditSnapshot = {
  equipmentName: string;
  equipmentVisibleId: number;
  eventTypeCode: string;
  eventTypeId: number;
  eventTypeName: string;
  executionType: string;
  id: number;
  maintenanceSettingId: number;
};

export async function getEquipmentEventAuditSnapshot(
  tx: Prisma.TransactionClient,
  id: number,
): Promise<EquipmentEventAuditSnapshot> {
  const event = await tx.event.findUnique({
    where: { id },
    select: equipmentEventAuditSelect,
  });

  if (!event) {
    throwEquipmentEventNotFound(
      'EVENT_NOT_FOUND',
      'Событие оборудования не найдено.',
    );
  }

  if (
    event.extensionCode !== EventExtensionCode.EQUIPMENT ||
    !event.equipmentExtension
  ) {
    throwEquipmentEventNotFound(
      'EVENT_EXTENSION_NOT_FOUND',
      'Расширение оборудования для события не найдено.',
    );
  }

  return {
    equipmentName: event.equipmentExtension.equipment.name,
    equipmentVisibleId: event.equipmentExtension.equipment.visibleId,
    eventTypeCode: event.equipmentExtension.eventType.code,
    eventTypeId: event.equipmentExtension.eventType.id,
    eventTypeName: event.equipmentExtension.eventType.name,
    executionType: event.equipmentExtension.executionType,
    id: event.id,
    maintenanceSettingId: event.equipmentExtension.maintenanceSettingId,
  };
}

export async function writeEquipmentEventCreatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EquipmentEventAuditSnapshot;
    userId?: string | null;
  },
): Promise<void> {
  await tx.auditLog.createMany({
    data: [
      auditLine(params, 'Оборудование', equipmentLabel(params.event)),
      auditLine(params, 'Вид обслуживания', eventTypeLabel(params.event)),
      auditLine(
        params,
        'Настройка обслуживания',
        formatId(params.event.maintenanceSettingId),
      ),
      auditLine(params, 'Способ выполнения', params.event.executionType),
    ],
  });
}

export async function writeEquipmentEventStatusAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: {
      id: number;
    };
    newStatus: EventStatus;
    oldStatus: EventStatus;
    userId?: string | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: AuditAction.STATUS_CHANGE,
      entityId: params.event.id,
      entityType: 'equipment_event',
      fieldName: 'Статус события',
      module: AuditModule.EQUIPMENT,
      newValue: params.newStatus,
      oldValue: params.oldStatus,
      userId: params.userId ?? null,
    },
  });
}

export async function writeEquipmentEventUpdatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    newEvent: EquipmentEventAuditSnapshot;
    oldEvent: EquipmentEventAuditSnapshot;
    userId?: string | null;
  },
): Promise<void> {
  const lines = buildUpdateLines(params);

  if (lines.length === 0) {
    return;
  }

  await tx.auditLog.createMany({ data: lines });
}

function buildUpdateLines(params: {
  newEvent: EquipmentEventAuditSnapshot;
  oldEvent: EquipmentEventAuditSnapshot;
  userId?: string | null;
}) {
  const comparisons = [
    {
      fieldName: 'Оборудование',
      newValue: equipmentLabel(params.newEvent),
      oldValue: equipmentLabel(params.oldEvent),
    },
    {
      fieldName: 'Вид обслуживания',
      newValue: eventTypeLabel(params.newEvent),
      oldValue: eventTypeLabel(params.oldEvent),
    },
    {
      fieldName: 'Настройка обслуживания',
      newValue: formatId(params.newEvent.maintenanceSettingId),
      oldValue: formatId(params.oldEvent.maintenanceSettingId),
    },
    {
      fieldName: 'Способ выполнения',
      newValue: params.newEvent.executionType,
      oldValue: params.oldEvent.executionType,
    },
  ];

  return comparisons
    .filter((item) => item.oldValue !== item.newValue)
    .map((item) => ({
      action: AuditAction.UPDATE,
      entityId: params.newEvent.id,
      entityType: 'equipment_event',
      fieldName: item.fieldName,
      module: AuditModule.EQUIPMENT,
      newValue: item.newValue,
      oldValue: item.oldValue,
      userId: params.userId ?? null,
    }));
}

function auditLine(
  params: {
    event: EquipmentEventAuditSnapshot;
    userId?: string | null;
  },
  fieldName: string,
  newValue: string,
) {
  return {
    action: AuditAction.CREATE,
    entityId: params.event.id,
    entityType: 'equipment_event',
    fieldName,
    module: AuditModule.EQUIPMENT,
    newValue,
    oldValue: null,
    userId: params.userId ?? null,
  };
}

function equipmentLabel(event: EquipmentEventAuditSnapshot) {
  return `ID ${event.equipmentVisibleId} — ${event.equipmentName}`;
}

function eventTypeLabel(event: EquipmentEventAuditSnapshot) {
  return `${event.eventTypeName} [${event.eventTypeCode}] #${event.eventTypeId}`;
}

function formatId(value: number) {
  return `#${value}`;
}
