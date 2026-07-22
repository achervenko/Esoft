import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  AuditModule,
  EquipmentStatus,
  Prisma,
} from '@prisma/client';
import { DATABASE_DATE_TIME_ZONE } from '../application/business-date';
import { PrismaService } from '../prisma/prisma.service';

type AuditFieldLine = {
  label: string;
  value: unknown;
};

type EquipmentUpdateAuditLine = {
  fieldLabel: string;
  newValue: unknown;
  oldValue: unknown;
};

type AuditFieldChange = {
  fieldName: string;
  newValue: unknown;
  oldValue?: unknown;
};

type WriteAuditParams = {
  action: AuditAction;
  entityId?: number | null;
  entityType: string;
  fields: AuditFieldChange[];
  module: AuditModule;
  tx?: Prisma.TransactionClient;
  userId?: string | null;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logEquipmentCreated(
    equipmentId: number,
    userId: string | null | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const equipment = await tx.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        country: true,
        model: {
          include: {
            manufacturer: true,
          },
        },
        responsibleEmployee: true,
        section: {
          include: {
            workshop: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new Error(
        `Cannot write equipment creation audit: equipment ${equipmentId} not found`,
      );
    }

    const lines: AuditFieldLine[] = [
      { label: 'ID', value: equipment.visibleId },
      { label: 'Название оборудования', value: equipment.name },
      { label: 'Производитель', value: equipment.model.manufacturer.name },
      { label: 'Модель', value: equipment.model.name },
      { label: 'Технические характеристики', value: equipment.specifications },
      { label: 'Заводской номер', value: equipment.serialNumber },
      { label: 'Инвентарный номер', value: equipment.inventoryNumber },
      { label: 'Страна производства', value: equipment.country?.name },
      { label: 'Год выпуска', value: equipment.manufactureYear },
      {
        label: 'Дата ввода в эксплуатацию',
        value: this.formatDate(equipment.commissioningDate),
      },
      { label: 'Дата выдачи', value: this.formatDate(equipment.issueDate) },
      {
        label: 'Местонахождение',
        value: `${equipment.section.workshop.name} / ${equipment.section.name}`,
      },
      {
        label: 'Ответственный',
        value: [
          equipment.responsibleEmployee.lastName,
          equipment.responsibleEmployee.firstName,
          equipment.responsibleEmployee.middleName,
        ]
          .filter(Boolean)
          .join(' '),
      },
      { label: 'Статус', value: this.getStatusLabel(equipment.status) },
      { label: 'Технологическая операция', value: equipment.operationText },
      { label: 'Примечание', value: equipment.notes },
    ];

    await this.writeFieldChanges({
      action: AuditAction.CREATE,
      entityId: equipment.id,
      entityType: 'equipment',
      fields: lines.map((line) => ({
        fieldName: line.label,
        newValue: line.value,
      })),
      module: AuditModule.EQUIPMENT,
      tx,
      userId,
    });
  }

  async logEquipmentUpdated(params: {
    equipmentId: number;
    lines: EquipmentUpdateAuditLine[];
    tx: Prisma.TransactionClient;
    userId?: string | null;
  }) {
    await this.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityId: params.equipmentId,
      entityType: 'equipment',
      fields: params.lines.map((line) => ({
        fieldName: line.fieldLabel,
        newValue: line.newValue,
        oldValue: line.oldValue,
      })),
      module: AuditModule.EQUIPMENT,
      tx: params.tx,
      userId: params.userId,
    });
  }

  async writeFieldChanges(params: WriteAuditParams) {
    if (params.fields.length === 0) {
      return;
    }

    const prisma = params.tx ?? this.prisma;

    await prisma.auditLog.createMany({
      data: params.fields.map((field) => ({
        action: params.action,
        entityId: params.entityId ?? null,
        entityType: params.entityType,
        fieldName: field.fieldName,
        module: params.module,
        newValue: this.formatValue(field.newValue),
        oldValue:
          params.action === AuditAction.CREATE || field.oldValue === undefined
            ? null
            : this.formatValue(field.oldValue),
        userId: params.userId ?? null,
      })),
    });
  }

  private formatDate(value: Date | null) {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: DATABASE_DATE_TIME_ZONE,
    }).format(value);
  }

  private formatValue(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return 'не указано';
    }

    if (value instanceof Date) {
      return this.formatDate(value) ?? 'не указано';
    }

    if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    ) {
      return String(value);
    }

    const serialized = JSON.stringify(value);

    return serialized ?? Object.prototype.toString.call(value);
  }

  private getStatusLabel(status: EquipmentStatus) {
    const statusLabels: Record<EquipmentStatus, string> = {
      [EquipmentStatus.ACTIVE]: 'В эксплуатации',
      [EquipmentStatus.RESERVE]: 'Резерв',
      [EquipmentStatus.REPAIR]: 'В ремонте',
      [EquipmentStatus.MAINTENANCE]: 'На обслуживании',
      [EquipmentStatus.WRITTEN_OFF]: 'Списано',
    };

    return statusLabels[status];
  }
}
