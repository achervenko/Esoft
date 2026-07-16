import {
  AuditAction,
  AuditModule,
  EquipmentEventSource,
  EquipmentEventStatus,
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
  factDate: Date | null;
  id: number;
  maintenanceSettingId: number | null;
  note: string | null;
  originalPlannedDate: Date | null;
  plannedDate: Date | null;
  responsibles: string[];
  source: EquipmentEventSource;
  status: EquipmentEventStatus;
};

export async function getEquipmentEventAuditSnapshot(
  tx: Prisma.TransactionClient,
  id: number,
): Promise<EquipmentEventAuditSnapshot> {
  const event = await tx.equipmentEvent.findUnique({
    where: { id },
    select: equipmentEventAuditSelect,
  });

  if (!event) {
    throwEquipmentEventNotFound(
      'EVENT_NOT_FOUND',
      'Событие оборудования не найдено.',
    );
  }

  return {
    equipmentName: event.equipment.name,
    equipmentVisibleId: event.equipment.visibleId,
    eventTypeCode: event.eventType.code,
    eventTypeId: event.eventType.id,
    eventTypeName: event.eventType.name,
    executionType: event.executionType,
    factDate: event.factDate,
    id: event.id,
    maintenanceSettingId: event.maintenanceSettingId,
    note: event.note,
    originalPlannedDate: event.originalPlannedDate,
    plannedDate: event.plannedDate,
    responsibles: event.responsibles
      .map((item) => responsibleUserLabel(item.user))
      .sort((left, right) => left.localeCompare(right)),
    source: event.source,
    status: event.status,
  };
}

export async function writeEquipmentEventCreatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EquipmentEventAuditSnapshot;
    userId?: string | null;
  },
) {
  await tx.auditLog.createMany({
    data: [
      auditLine(params, 'Оборудование', equipmentLabel(params.event)),
      auditLine(params, 'Вид обслуживания', eventTypeLabel(params.event)),
      auditLine(
        params,
        'Настройка обслуживания',
        formatNullableId(params.event.maintenanceSettingId),
      ),
      auditLine(params, 'Способ выполнения', params.event.executionType),
      auditLine(params, 'Основание события', params.event.source),
      auditLine(params, 'Статус', params.event.status),
      auditLine(params, 'Фактическая дата', formatDate(params.event.factDate)),
      auditLine(params, 'Плановая дата', formatDate(params.event.plannedDate)),
      auditLine(
        params,
        'Первоначальная плановая дата',
        formatDate(params.event.originalPlannedDate),
      ),
      auditLine(params, 'Ответственные', responsibleList(params.event)),
      auditLine(params, 'Комментарий', formatNullableText(params.event.note)),
    ],
  });
}

export async function writeEquipmentEventStatusAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EquipmentEventAuditSnapshot;
    newStatus: EquipmentEventStatus;
    oldStatus: EquipmentEventStatus;
    userId?: string | null;
  },
) {
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
) {
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
      newValue: formatNullableId(params.newEvent.maintenanceSettingId),
      oldValue: formatNullableId(params.oldEvent.maintenanceSettingId),
    },
    {
      fieldName: 'Способ выполнения',
      newValue: params.newEvent.executionType,
      oldValue: params.oldEvent.executionType,
    },
    {
      fieldName: 'Фактическая дата',
      newValue: formatDate(params.newEvent.factDate),
      oldValue: formatDate(params.oldEvent.factDate),
    },
    {
      fieldName: 'Плановая дата',
      newValue: formatDate(params.newEvent.plannedDate),
      oldValue: formatDate(params.oldEvent.plannedDate),
    },
    {
      fieldName: 'Ответственные',
      newValue: responsibleList(params.newEvent),
      oldValue: responsibleList(params.oldEvent),
    },
    {
      fieldName: 'Комментарий',
      newValue: formatNullableText(params.newEvent.note),
      oldValue: formatNullableText(params.oldEvent.note),
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

function responsibleUserLabel(user: {
  employeeUser: {
    employee: {
      firstName: string;
      lastName: string;
      middleName: string | null;
    };
  } | null;
  id: string;
  name: string;
}) {
  const employee = user.employeeUser?.employee;
  const fullName = employee
    ? [employee.lastName, employee.firstName, employee.middleName]
        .filter(Boolean)
        .join(' ')
    : user.name;

  return `${fullName} #${user.id}`;
}

function responsibleList(event: EquipmentEventAuditSnapshot) {
  return event.responsibles.join(', ') || 'не указано';
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? 'не указано';
}

function formatNullableId(value: number | null) {
  return value === null ? 'не указано' : `#${value}`;
}

function formatNullableText(value: string | null) {
  return value ?? 'не указано';
}
