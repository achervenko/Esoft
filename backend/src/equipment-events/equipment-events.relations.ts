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
  checklistTemplateId: true,
  equipment: {
    select: equipmentListSelect,
  },
  eventType: {
    select: eventTypeResponseSelect,
  },
  executionType: true,
  factDate: true,
  id: true,
  maintenanceSettingId: true,
  note: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  version: true,
} satisfies Prisma.EquipmentEventSelect;

export const equipmentEventDetailSelect = {
  checklistTemplateId: true,
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
  executionType: true,
  factDate: true,
  id: true,
  maintenanceSettingId: true,
  note: true,
  originalPlannedDate: true,
  plannedDate: true,
  responsibles: responsiblesResponseSelect,
  source: true,
  status: true,
  version: true,
} satisfies Prisma.EquipmentEventSelect;

export const equipmentEventAuditSelect = {
  checklistTemplateId: true,
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
  factDate: true,
  id: true,
  maintenanceSettingId: true,
  note: true,
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
