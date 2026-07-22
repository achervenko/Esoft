import { Prisma } from '@prisma/client';
import { DATABASE_DATE_TIME_ZONE } from '../application/business-date';
import { EquipmentWithAuditRelations } from './equipment-relations';
import { getEquipmentStatusLabel } from './equipment-presenter';

export function toAuditUserName(
  user: Prisma.UserGetPayload<{
    include: {
      employeeUser: {
        include: {
          employee: true;
        };
      };
    };
  }>,
) {
  const employee = user.employeeUser?.employee;

  if (employee) {
    return [employee.lastName, employee.firstName, employee.middleName]
      .filter(Boolean)
      .join(' ');
  }

  return user.displayUsername || user.username || user.name || 'Пользователь';
}

export function getEquipmentAuditChanges(
  oldEquipment: EquipmentWithAuditRelations,
  newEquipment: EquipmentWithAuditRelations,
) {
  const oldValues = toEquipmentAuditValues(oldEquipment);
  const newValues = toEquipmentAuditValues(newEquipment);

  return Object.entries(newValues)
    .filter(([key, newValue]) => oldValues[key] !== newValue)
    .map(([fieldLabel, newValue]) => ({
      fieldLabel,
      oldValue: oldValues[fieldLabel],
      newValue,
    }));
}

export function toEquipmentAuditValues(
  equipment: EquipmentWithAuditRelations,
): Record<string, string | null> {
  return {
    ID: String(equipment.visibleId),
    'Название оборудования': equipment.name,
    Производитель: equipment.model.manufacturer.name,
    Модель: equipment.model.name,
    'Технические характеристики': equipment.specifications,
    'Заводской номер': equipment.serialNumber,
    'Инвентарный номер': equipment.inventoryNumber,
    'Страна производства': equipment.country?.name ?? null,
    'Год выпуска': toNullableAuditValue(equipment.manufactureYear),
    'Дата ввода в эксплуатацию': formatDateForAudit(
      equipment.commissioningDate,
    ),
    'Дата выдачи': formatDateForAudit(equipment.issueDate),
    Местонахождение: `${equipment.section.workshop.name} / ${equipment.section.name}`,
    Ответственный: [
      equipment.responsibleEmployee.lastName,
      equipment.responsibleEmployee.firstName,
      equipment.responsibleEmployee.middleName,
    ]
      .filter(Boolean)
      .join(' '),
    Статус: getEquipmentStatusLabel(equipment.status),
    'Технологическая операция': equipment.operationText,
    Примечание: equipment.notes,
  };
}

export function toNullableAuditValue(
  value: number | string | null | undefined,
) {
  return value === null || value === undefined ? null : String(value);
}

export function formatDateForAudit(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: DATABASE_DATE_TIME_ZONE,
  }).format(value);
}
