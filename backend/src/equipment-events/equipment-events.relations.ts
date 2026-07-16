import { ChecklistStatus, Prisma } from '@prisma/client';

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
} satisfies Prisma.EquipmentEventResponsibleFindManyArgs;

export const equipmentEventListSelect = {
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

export type EquipmentEventChecklistRecord = {
  assignedUserId: string;
  checklistTemplateId: number;
  id: number;
  isRequired: boolean;
  sortOrder: number;
  status: ChecklistStatus;
};
