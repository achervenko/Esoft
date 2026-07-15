import { Prisma } from '@prisma/client';

const employeeResponseSelect = {
  firstName: true,
  id: true,
  lastName: true,
  middleName: true,
  position: true,
} satisfies Prisma.EmployeeSelect;

const employeeNameSelect = {
  firstName: true,
  id: true,
  lastName: true,
  middleName: true,
} satisfies Prisma.EmployeeSelect;

const responsiblesOrderBy = [
  { employee: { lastName: 'asc' } },
  { employee: { firstName: 'asc' } },
  { employee: { middleName: 'asc' } },
] satisfies Prisma.EquipmentEventResponsibleOrderByWithRelationInput[];

const equipmentListSelect = {
  id: true,
  model: {
    select: {
      id: true,
      name: true,
    },
  },
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

const equipmentDetailSelect = {
  id: true,
  model: {
    select: {
      id: true,
      manufacturer: {
        select: {
          id: true,
          name: true,
        },
      },
      name: true,
    },
  },
  name: true,
  visibleId: true,
} satisfies Prisma.EquipmentSelect;

const eventTypeResponseSelect = {
  code: true,
  id: true,
  name: true,
} satisfies Prisma.EquipmentEventTypeSelect;

const responsiblesResponseSelect = {
  orderBy: responsiblesOrderBy,
  select: {
    employee: {
      select: employeeResponseSelect,
    },
  },
} satisfies Prisma.EquipmentEventResponsibleFindManyArgs;

export const equipmentEventListSelect = {
  equipment: {
    select: equipmentListSelect,
  },
  eventType: {
    select: eventTypeResponseSelect,
  },
  factDate: true,
  id: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  version: true,
} satisfies Prisma.EquipmentEventSelect;

export const equipmentEventDetailSelect = {
  createdAt: true,
  createdByEmployee: {
    select: employeeResponseSelect,
  },
  equipment: {
    select: equipmentDetailSelect,
  },
  eventType: {
    select: eventTypeResponseSelect,
  },
  factDate: true,
  id: true,
  originalPlannedDate: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  version: true,
} satisfies Prisma.EquipmentEventSelect;

export const equipmentEventAuditSelect = {
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
  factDate: true,
  id: true,
  originalPlannedDate: true,
  plannedDate: true,
  responsibles: {
    orderBy: responsiblesOrderBy,
    select: {
      employee: {
        select: employeeNameSelect,
      },
    },
  },
  source: true,
  status: true,
} satisfies Prisma.EquipmentEventSelect;

export type EquipmentEventListRecord = Prisma.EquipmentEventGetPayload<{
  select: typeof equipmentEventListSelect;
}>;

export type EquipmentEventDetailRecord = Prisma.EquipmentEventGetPayload<{
  select: typeof equipmentEventDetailSelect;
}>;

export type EquipmentEventAuditRecord = Prisma.EquipmentEventGetPayload<{
  select: typeof equipmentEventAuditSelect;
}>;
