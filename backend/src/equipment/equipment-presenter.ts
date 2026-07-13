import { EquipmentStatus } from '@prisma/client';
import { EquipmentWithAuditRelations } from './equipment-relations';

export function toEquipmentListItem(item: {
  id: number;
  visibleId: number;
  name: string;
  inventoryNumber: string;
  serialNumber: string | null;
  model: string | null;
  status: EquipmentStatus;
  manufacturer: { name: string } | null;
}) {
  return {
    id: item.id,
    visibleId: item.visibleId,
    name: item.name,
    inventoryNumber: item.inventoryNumber,
    serialNumber: item.serialNumber,
    manufacturer: item.manufacturer?.name ?? 'Не указан',
    model: item.model ?? 'Не указана',
    status: item.status,
    statusLabel: getEquipmentStatusLabel(item.status),
  };
}

export function toEquipmentCard(equipment: EquipmentWithAuditRelations) {
  return {
    id: equipment.id,
    visibleId: equipment.visibleId,
    name: equipment.name,
    inventoryNumber: equipment.inventoryNumber,
    serialNumber: equipment.serialNumber,
    manufacturerId: equipment.manufacturerId,
    manufacturer: equipment.manufacturer?.name ?? 'Не указан',
    model: equipment.model ?? 'Не указана',
    specifications: equipment.specifications,
    countryId: equipment.countryId,
    country: equipment.country?.name ?? 'Не указана',
    manufactureYear: equipment.manufactureYear,
    commissioningDate: equipment.commissioningDate,
    issueDate: equipment.issueDate,
    sectionId: equipment.sectionId,
    location: `${equipment.section.workshop.name} / ${equipment.section.name}`,
    responsibleEmployeeId: equipment.responsibleEmployeeId,
    responsible: [
      equipment.responsibleEmployee.lastName,
      equipment.responsibleEmployee.firstName,
      equipment.responsibleEmployee.middleName,
    ]
      .filter(Boolean)
      .join(' '),
    responsiblePosition: equipment.responsibleEmployee.position,
    status: equipment.status,
    statusLabel: getEquipmentStatusLabel(equipment.status),
    operationText: equipment.operationText,
    notes: equipment.notes,
  };
}

export function getEquipmentStatusLabel(status: EquipmentStatus) {
  const statusLabels: Record<EquipmentStatus, string> = {
    [EquipmentStatus.ACTIVE]: 'В эксплуатации',
    [EquipmentStatus.RESERVE]: 'Резерв',
    [EquipmentStatus.REPAIR]: 'В ремонте',
    [EquipmentStatus.MAINTENANCE]: 'На обслуживании',
    [EquipmentStatus.WRITTEN_OFF]: 'Списано',
  };

  return statusLabels[status];
}

export function getEquipmentStatusOptions() {
  return [
    EquipmentStatus.ACTIVE,
    EquipmentStatus.RESERVE,
    EquipmentStatus.REPAIR,
    EquipmentStatus.MAINTENANCE,
    EquipmentStatus.WRITTEN_OFF,
  ].map((status) => ({
    value: status,
    label: getEquipmentStatusLabel(status),
  }));
}
