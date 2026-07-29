import { ChecklistStatus, Prisma } from '@prisma/client';
import type { EventExtensionPresenterRecord } from './event-extensions/event-extension.adapter';
import type { EventExtensionRegistry } from './event-extensions/event-extension.registry';

const employeeResponseSelect = {
  firstName: true,
  id: true,
  lastName: true,
  middleName: true,
  position: true,
} satisfies Prisma.EmployeeSelect;

const responsiblesOrderBy = [
  { user: { employeeUser: { employee: { lastName: 'asc' } } } },
  { user: { employeeUser: { employee: { firstName: 'asc' } } } },
  { user: { name: 'asc' } },
] satisfies Prisma.EventResponsibleOrderByWithRelationInput[];

const responsiblesResponseSelect = {
  orderBy: responsiblesOrderBy,
  select: {
    user: {
      select: {
        employeeUser: {
          select: {
            employee: {
              select: employeeResponseSelect,
            },
          },
        },
        id: true,
        name: true,
        role: true,
      },
    },
  },
} satisfies Prisma.EventResponsibleFindManyArgs;

const eventListBaseSelect = {
  extensionCode: true,
  factDate: true,
  id: true,
  note: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  title: true,
  version: true,
} satisfies Prisma.EventSelect;

const eventDetailBaseSelect = {
  createdAt: true,
  createdByEmployee: {
    select: employeeResponseSelect,
  },
  extensionCode: true,
  factDate: true,
  id: true,
  note: true,
  originalPlannedDate: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  title: true,
  version: true,
} satisfies Prisma.EventSelect;

export function buildEventListSelect(
  extensionRegistry: EventExtensionRegistry,
): Prisma.EventSelect {
  return {
    ...eventListBaseSelect,
    ...extensionRegistry.getListSelect(),
  };
}

export function buildEventDetailSelect(
  extensionRegistry: EventExtensionRegistry,
): Prisma.EventSelect {
  return {
    ...eventDetailBaseSelect,
    ...extensionRegistry.getDetailSelect(),
  };
}

export type EventListRecord = EventExtensionPresenterRecord &
  Prisma.EventGetPayload<{
    select: typeof eventListBaseSelect;
  }>;

export type EventDetailRecord = EventExtensionPresenterRecord &
  Prisma.EventGetPayload<{
    select: typeof eventDetailBaseSelect;
  }>;

export type EventChecklistRecord = {
  assignedUser: {
    fullName: string;
    id: string;
    position: string;
  };
  assignedUserId: string;
  checklistTemplateId: number;
  id: number;
  progress: {
    answered: number;
    requiredAnswered: number;
    requiredTotal: number;
    total: number;
  };
  sortOrder: number;
  status: ChecklistStatus;
  templateName: string;
};
