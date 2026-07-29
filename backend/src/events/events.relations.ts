import { ChecklistStatus, Prisma } from '@prisma/client';
import {
  equipmentEventExtensionDetailSelect,
  equipmentEventExtensionListSelect,
} from '../equipment-event-extension/equipment-event-extension.relations';

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

export const eventListSelect = {
  equipmentExtension: {
    select: equipmentEventExtensionListSelect,
  },
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

export const eventDetailSelect = {
  createdAt: true,
  createdByEmployee: {
    select: employeeResponseSelect,
  },
  equipmentExtension: {
    select: equipmentEventExtensionDetailSelect,
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

export type EventListRecord = Prisma.EventGetPayload<{
  select: typeof eventListSelect;
}>;

export type EventDetailRecord = Prisma.EventGetPayload<{
  select: typeof eventDetailSelect;
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
