import type {
  EquipmentEventChecklistRecord,
  EquipmentEventDetailRecord,
  EquipmentEventListRecord,
} from './equipment-events.relations';

export function toEquipmentEventListResponse(
  event: EquipmentEventListRecord,
  checklists: EquipmentEventChecklistRecord[] = [],
) {
  return {
    id: event.id,
    source: event.source,
    status: event.status,
    version: event.version,
    maintenanceSettingId: event.maintenanceSettingId,
    executionType: event.executionType,
    factDate: formatDate(event.factDate),
    note: event.note,
    plannedDate: formatDate(event.plannedDate),
    equipment: {
      id: event.equipment.id,
      visibleId: event.equipment.visibleId,
      name: event.equipment.name,
      model: {
        id: event.equipment.model.id,
        name: event.equipment.model.name,
      },
    },
    maintenanceType: {
      id: event.eventType.id,
      name: event.eventType.name,
      code: event.eventType.code,
    },
    checklists: checklists.map(toChecklistResponse),
    responsibles: event.responsibles.map((item) => toUserResponse(item.user)),
  };
}

export function toEquipmentEventDetailResponse(
  event: EquipmentEventDetailRecord,
  checklists: EquipmentEventChecklistRecord[] = [],
) {
  return {
    id: event.id,
    source: event.source,
    status: event.status,
    version: event.version,
    maintenanceSettingId: event.maintenanceSettingId,
    executionType: event.executionType,
    originalPlannedDate: formatDate(event.originalPlannedDate),
    plannedDate: formatDate(event.plannedDate),
    factDate: formatDate(event.factDate),
    note: event.note,
    createdAt: event.createdAt.toISOString(),
    equipment: {
      id: event.equipment.id,
      visibleId: event.equipment.visibleId,
      name: event.equipment.name,
      model: {
        id: event.equipment.model.id,
        name: event.equipment.model.name,
        manufacturer: {
          id: event.equipment.model.manufacturer.id,
          name: event.equipment.model.manufacturer.name,
        },
      },
    },
    maintenanceType: {
      id: event.eventType.id,
      name: event.eventType.name,
      code: event.eventType.code,
    },
    createdBy: toEmployeeResponse(event.createdByEmployee),
    checklists: checklists.map(toChecklistResponse),
    responsibles: event.responsibles.map((item) => toUserResponse(item.user)),
  };
}

type EmployeeLike = {
  firstName: string;
  id: number;
  lastName: string;
  middleName: string | null;
  position: string;
};

type ResponsibleUserLike = {
  employeeUser: {
    employee: EmployeeLike;
  } | null;
  id: string;
  name: string;
  role: string | null;
};

function toEmployeeResponse(employee: EmployeeLike) {
  return {
    id: employee.id,
    fullName: [employee.lastName, employee.firstName, employee.middleName]
      .filter(Boolean)
      .join(' '),
    position: employee.position,
  };
}

function toUserResponse(user: ResponsibleUserLike) {
  const employee = user.employeeUser?.employee;

  return {
    id: user.id,
    fullName: employee
      ? [employee.lastName, employee.firstName, employee.middleName]
          .filter(Boolean)
          .join(' ')
      : user.name,
    position: employee?.position ?? '',
    role: user.role,
  };
}

function toChecklistResponse(checklist: EquipmentEventChecklistRecord) {
  return {
    id: checklist.id,
    checklistTemplateId: checklist.checklistTemplateId,
    templateName: checklist.templateName,
    assignedUserId: checklist.assignedUserId,
    assignedUser: checklist.assignedUser,
    status: checklist.status,
    sortOrder: checklist.sortOrder,
    progress: checklist.progress,
  };
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
