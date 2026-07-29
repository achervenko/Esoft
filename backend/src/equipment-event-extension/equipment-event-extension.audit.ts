import {
  AuditAction,
  AuditModule,
  EventExtensionCode,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { throwEquipmentEventExtensionNotFound } from './equipment-event-extension.errors';

const equipmentEventExtensionAuditSelect = {
  equipmentExtension: {
    select: {
      equipment: {
        select: {
          name: true,
          visibleId: true,
        },
      },
      eventType: {
        select: {
          code: true,
          id: true,
          name: true,
        },
      },
      executionType: true,
      maintenanceSettingId: true,
    },
  },
  extensionCode: true,
  id: true,
} satisfies Prisma.EventSelect;

export type EquipmentEventExtensionAuditSnapshot = {
  equipmentName: string;
  equipmentVisibleId: number;
  eventTypeCode: string;
  eventTypeId: number;
  eventTypeName: string;
  executionType: string;
  id: number;
  maintenanceSettingId: number;
};

export async function getEquipmentEventExtensionAuditSnapshot(
  tx: Prisma.TransactionClient,
  id: number,
): Promise<EquipmentEventExtensionAuditSnapshot> {
  const event = await tx.event.findUnique({
    where: { id },
    select: equipmentEventExtensionAuditSelect,
  });

  if (!event) {
    throwEquipmentEventExtensionNotFound(
      'EVENT_NOT_FOUND',
      'Событие оборудования не найдено.',
    );
  }

  if (
    event.extensionCode !== EventExtensionCode.EQUIPMENT ||
    !event.equipmentExtension
  ) {
    throwEquipmentEventExtensionNotFound(
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

export async function writeEquipmentEventExtensionCreatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EquipmentEventExtensionAuditSnapshot;
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

export async function writeEquipmentEventExtensionStatusAudit(
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

export async function writeEquipmentEventExtensionUpdatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    newEvent: EquipmentEventExtensionAuditSnapshot;
    oldEvent: EquipmentEventExtensionAuditSnapshot;
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
  newEvent: EquipmentEventExtensionAuditSnapshot;
  oldEvent: EquipmentEventExtensionAuditSnapshot;
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
    event: EquipmentEventExtensionAuditSnapshot;
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

function equipmentLabel(event: EquipmentEventExtensionAuditSnapshot) {
  return `ID ${event.equipmentVisibleId} — ${event.equipmentName}`;
}

function eventTypeLabel(event: EquipmentEventExtensionAuditSnapshot) {
  return `${event.eventTypeName} [${event.eventTypeCode}] #${event.eventTypeId}`;
}

function formatId(value: number) {
  return `#${value}`;
}
