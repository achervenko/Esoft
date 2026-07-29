import {
  AuditAction,
  AuditModule,
  EventSource,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { throwEventNotFound } from './events.errors';

const EVENT_ENTITY_TYPE = 'event';
const EVENT_AUDIT_MODULE = AuditModule.EVENTS;

export type EventAuditSnapshot = {
  factDate: Date | null;
  id: number;
  note: string | null;
  originalPlannedDate: Date | null;
  plannedDate: Date;
  responsibles: string[];
  source: EventSource;
  status: EventStatus;
  title: string;
};

export async function getEventAuditSnapshot(
  tx: Prisma.TransactionClient,
  id: number,
): Promise<EventAuditSnapshot> {
  const event = await tx.event.findUnique({
    where: { id },
    select: {
      factDate: true,
      id: true,
      note: true,
      originalPlannedDate: true,
      plannedDate: true,
      responsibles: {
        orderBy: [
          { user: { employeeUser: { employee: { lastName: 'asc' } } } },
          { user: { employeeUser: { employee: { firstName: 'asc' } } } },
          { user: { name: 'asc' } },
        ],
        select: {
          user: {
            select: {
              employeeUser: {
                select: {
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                      middleName: true,
                    },
                  },
                },
              },
              id: true,
              name: true,
            },
          },
        },
      },
      source: true,
      status: true,
      title: true,
    },
  });

  if (!event) {
    throwEventNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
  }

  return {
    factDate: event.factDate,
    id: event.id,
    note: event.note,
    originalPlannedDate: event.originalPlannedDate,
    plannedDate: event.plannedDate,
    responsibles: event.responsibles
      .map((item) => responsibleUserLabel(item.user))
      .sort((left, right) => left.localeCompare(right)),
    source: event.source,
    status: event.status,
    title: event.title,
  };
}

export async function writeEventStatusAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EventAuditSnapshot;
    newStatus: EventStatus;
    oldStatus: EventStatus;
    userId?: string | null;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: AuditAction.STATUS_CHANGE,
      entityId: params.event.id,
      entityType: EVENT_ENTITY_TYPE,
      fieldName: 'Статус события',
      module: EVENT_AUDIT_MODULE,
      newValue: params.newStatus,
      oldValue: params.oldStatus,
      userId: params.userId ?? null,
    },
  });
}

export async function writeEventCreatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    event: EventAuditSnapshot;
    userId?: string | null;
  },
): Promise<void> {
  await tx.auditLog.createMany({
    data: [
      createAuditLine(params, 'Название', params.event.title),
      createAuditLine(params, 'Основание события', params.event.source),
      createAuditLine(params, 'Статус', params.event.status),
      createAuditLine(
        params,
        'Фактическая дата',
        formatDate(params.event.factDate),
      ),
      createAuditLine(
        params,
        'Плановая дата',
        formatDate(params.event.plannedDate),
      ),
      createAuditLine(
        params,
        'Первоначальная плановая дата',
        formatDate(params.event.originalPlannedDate),
      ),
      createAuditLine(params, 'Ответственные', responsibleList(params.event)),
      createAuditLine(
        params,
        'Комментарий',
        formatNullableText(params.event.note),
      ),
    ],
  });
}

export async function writeEventUpdatedAudit(
  tx: Prisma.TransactionClient,
  params: {
    newEvent: EventAuditSnapshot;
    oldEvent: EventAuditSnapshot;
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
  newEvent: EventAuditSnapshot;
  oldEvent: EventAuditSnapshot;
  userId?: string | null;
}) {
  const comparisons = [
    {
      fieldName: 'Название',
      newValue: params.newEvent.title,
      oldValue: params.oldEvent.title,
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
      fieldName: 'Первоначальная плановая дата',
      newValue: formatDate(params.newEvent.originalPlannedDate),
      oldValue: formatDate(params.oldEvent.originalPlannedDate),
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
      entityType: EVENT_ENTITY_TYPE,
      fieldName: item.fieldName,
      module: EVENT_AUDIT_MODULE,
      newValue: item.newValue,
      oldValue: item.oldValue,
      userId: params.userId ?? null,
    }));
}

function createAuditLine(
  params: {
    event: EventAuditSnapshot;
    userId?: string | null;
  },
  fieldName: string,
  newValue: string,
) {
  return {
    action: AuditAction.CREATE,
    entityId: params.event.id,
    entityType: EVENT_ENTITY_TYPE,
    fieldName,
    module: EVENT_AUDIT_MODULE,
    newValue,
    oldValue: null,
    userId: params.userId ?? null,
  };
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

function responsibleList(event: EventAuditSnapshot) {
  return event.responsibles.join(', ') || 'не указано';
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? 'не указано';
}

function formatNullableText(value: string | null) {
  return value ?? 'не указано';
}
