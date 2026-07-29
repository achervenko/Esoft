import type {
  EquipmentEventChecklistRecord,
  EquipmentEventDetailRecordWithExtension,
  EquipmentEventListRecordWithExtension,
} from './equipment-events.relations';
import {
  toEquipmentEventExtensionDetailResponse,
  toEquipmentEventExtensionListResponse,
} from '../equipment-event-extension/equipment-event-extension.presenter';

export function toEquipmentEventListResponse(
  event: EquipmentEventListRecordWithExtension,
  checklists: EquipmentEventChecklistRecord[] = [],
) {
  const extension = toEquipmentEventExtensionListResponse(
    event.equipmentExtension,
  );

  return {
    id: event.id,
    title: event.title,
    extensionCode: event.extensionCode,
    source: event.source,
    status: event.status,
    version: event.version,
    factDate: formatDate(event.factDate),
    note: event.note,
    plannedDate: formatDate(event.plannedDate),
    extension,
    maintenanceSettingId: extension.maintenanceSettingId,
    executionType: extension.executionType,
    equipment: extension.equipment,
    maintenanceType: extension.maintenanceType,
    checklists: checklists.map(toChecklistResponse),
    responsibles: event.responsibles.map((item) => toUserResponse(item.user)),
  };
}

export function toEquipmentEventDetailResponse(
  event: EquipmentEventDetailRecordWithExtension,
  checklists: EquipmentEventChecklistRecord[] = [],
) {
  const extension = toEquipmentEventExtensionDetailResponse(
    event.equipmentExtension,
  );

  return {
    id: event.id,
    title: event.title,
    extensionCode: event.extensionCode,
    source: event.source,
    status: event.status,
    version: event.version,
    maintenanceSettingId: extension.maintenanceSettingId,
    executionType: extension.executionType,
    originalPlannedDate: formatDate(event.originalPlannedDate),
    plannedDate: formatDate(event.plannedDate),
    factDate: formatDate(event.factDate),
    note: event.note,
    createdAt: event.createdAt.toISOString(),
    extension,
    equipment: extension.equipment,
    maintenanceType: extension.maintenanceType,
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
