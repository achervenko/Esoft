import type {
  EquipmentEventDetailRecord,
  EquipmentEventListRecord,
} from './equipment-events.relations';

export function toEquipmentEventListResponse(event: EquipmentEventListRecord) {
  return {
    id: event.id,
    source: event.source,
    status: event.status,
    version: event.version,
    maintenanceSettingId: event.maintenanceSettingId,
    executionType: event.executionType,
    checklistTemplateId: event.checklistTemplateId,
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
    responsibles: event.responsibles.map((item) =>
      toEmployeeResponse(item.employee),
    ),
    checklist: event.checklistTemplateId
      ? { id: event.checklistTemplateId }
      : null,
  };
}

export function toEquipmentEventDetailResponse(event: EquipmentEventDetailRecord) {
  return {
    id: event.id,
    source: event.source,
    status: event.status,
    version: event.version,
    maintenanceSettingId: event.maintenanceSettingId,
    executionType: event.executionType,
    checklistTemplateId: event.checklistTemplateId,
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
    responsibles: event.responsibles.map((item) =>
      toEmployeeResponse(item.employee),
    ),
    checklist: event.checklistTemplateId
      ? { id: event.checklistTemplateId }
      : null,
  };
}

type EmployeeLike = {
  firstName: string;
  id: number;
  lastName: string;
  middleName: string | null;
  position: string;
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

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
