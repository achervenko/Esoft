import { EventExtensionCode } from '@prisma/client';
import {
  toEquipmentEventExtensionDetailResponse,
  toEquipmentEventExtensionListResponse,
} from '../equipment-event-extension/equipment-event-extension.presenter';
import { throwEventConflict } from './events.errors';
import type {
  EventChecklistRecord,
  EventDetailRecord,
  EventListRecord,
} from './events.relations';

export function toEventListResponse(
  event: EventListRecord,
  checklists: EventChecklistRecord[] = [],
) {
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
    extension: toEventListExtensionResponse(event),
    checklists: checklists.map(toChecklistResponse),
    responsibles: event.responsibles.map((item) => toUserResponse(item.user)),
  };
}

export function toEventDetailResponse(
  event: EventDetailRecord,
  checklists: EventChecklistRecord[] = [],
) {
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
    extension: toEventDetailExtensionResponse(event),
    checklists: checklists.map(toChecklistResponse),
    responsibles: event.responsibles.map((item) => toUserResponse(item.user)),
    originalPlannedDate: formatDate(event.originalPlannedDate),
    createdAt: event.createdAt.toISOString(),
    createdBy: toEmployeeResponse(event.createdByEmployee),
  };
}

function toEventListExtensionResponse(event: EventListRecord) {
  switch (event.extensionCode) {
    case null:
      if (event.equipmentExtension) {
        throwEventConflict(
          'EVENT_EXTENSION_CONFLICT',
          'Данные расширения события не соответствуют его типу.',
        );
      }

      return null;

    case EventExtensionCode.EQUIPMENT:
      if (!event.equipmentExtension) {
        throwEventConflict(
          'EVENT_EXTENSION_CONFLICT',
          'Расширение оборудования для события не найдено.',
        );
      }

      return toEquipmentEventExtensionListResponse(event.equipmentExtension);
  }

  throwEventUnsupportedExtension();
}

function toEventDetailExtensionResponse(event: EventDetailRecord) {
  switch (event.extensionCode) {
    case null:
      if (event.equipmentExtension) {
        throwEventConflict(
          'EVENT_EXTENSION_CONFLICT',
          'Данные расширения события не соответствуют его типу.',
        );
      }

      return null;

    case EventExtensionCode.EQUIPMENT:
      if (!event.equipmentExtension) {
        throwEventConflict(
          'EVENT_EXTENSION_CONFLICT',
          'Расширение оборудования для события не найдено.',
        );
      }

      return toEquipmentEventExtensionDetailResponse(event.equipmentExtension);
  }

  throwEventUnsupportedExtension();
}

function throwEventUnsupportedExtension(): never {
  throwEventConflict(
    'EVENT_EXTENSION_UNSUPPORTED',
    'Тип расширения события не поддерживается.',
  );
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

function toChecklistResponse(checklist: EventChecklistRecord) {
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
