import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  throwMaintenanceTypeConflict,
  throwMaintenanceTypeNotFound,
  throwMaintenanceTypePrismaError,
} from './maintenance-types.errors';
import type {
  CreateMaintenanceTypeInput,
  UpdateMaintenanceTypeInput,
} from './maintenance-types.validation';

@Injectable()
export class MaintenanceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTypes(includeInactive: boolean) {
    const maintenanceTypes = await this.prisma.equipmentEventType.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        code: true,
        id: true,
        isActive: true,
        name: true,
      },
      where: includeInactive ? undefined : { isActive: true },
    });

    return { maintenanceTypes };
  }

  async createType(input: CreateMaintenanceTypeInput, userId?: string | null) {
    try {
      const maintenanceType = await this.prisma.$transaction(async (tx) => {
        const createdType = await tx.equipmentEventType.create({
          data: {
            code: input.code,
            isActive: true,
            name: input.name,
          },
          select: maintenanceTypeSelect,
        });

        await this.writeAudit(tx, {
          action: AuditAction.CREATE,
          fieldName: 'Вид обслуживания',
          maintenanceTypeId: createdType.id,
          newValue: `${createdType.name} [${createdType.code}]`,
          oldValue: null,
          userId,
        });

        return createdType;
      });

      return { maintenanceType };
    } catch (error) {
      throwMaintenanceTypePrismaError(error);
    }
  }

  async updateType(
    id: number,
    input: UpdateMaintenanceTypeInput,
    userId?: string | null,
  ) {
    try {
      const maintenanceType = await this.prisma.$transaction(async (tx) => {
        const oldType = await this.loadType(id, tx);

        if (oldType.name === input.name) {
          return oldType;
        }

        const updatedType = await tx.equipmentEventType.update({
          data: { name: input.name },
          select: maintenanceTypeSelect,
          where: { id },
        });

        await this.writeAudit(tx, {
          action: AuditAction.UPDATE,
          fieldName: 'Название',
          maintenanceTypeId: id,
          newValue: updatedType.name,
          oldValue: oldType.name,
          userId,
        });

        return updatedType;
      });

      return { maintenanceType };
    } catch (error) {
      throwMaintenanceTypePrismaError(error);
    }
  }

  async activateType(id: number, userId?: string | null) {
    return this.setActive(id, true, userId);
  }

  async deactivateType(id: number, userId?: string | null) {
    return this.setActive(id, false, userId);
  }

  private async setActive(
    id: number,
    isActive: boolean,
    userId?: string | null,
  ) {
    try {
      const maintenanceType = await this.prisma.$transaction(async (tx) => {
        const oldType = await this.loadType(id, tx);

        if (oldType.isActive === isActive) {
          throwMaintenanceTypeConflict(
            isActive
              ? 'MAINTENANCE_TYPE_ALREADY_ACTIVE'
              : 'MAINTENANCE_TYPE_ALREADY_INACTIVE',
            isActive
              ? 'Вид обслуживания уже активен.'
              : 'Вид обслуживания уже отключён.',
          );
        }

        const updatedType = await tx.equipmentEventType.update({
          data: { isActive },
          select: maintenanceTypeSelect,
          where: { id },
        });

        await this.writeAudit(tx, {
          action: AuditAction.STATUS_CHANGE,
          fieldName: 'Активность',
          maintenanceTypeId: id,
          newValue: isActive,
          oldValue: oldType.isActive,
          userId,
        });

        return updatedType;
      });

      return { maintenanceType };
    } catch (error) {
      throwMaintenanceTypePrismaError(error);
    }
  }

  private async loadType(
    id: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const maintenanceType = await tx.equipmentEventType.findUnique({
      select: maintenanceTypeSelect,
      where: { id },
    });

    if (!maintenanceType) {
      throwMaintenanceTypeNotFound();
    }

    return maintenanceType;
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    params: {
      action: AuditAction;
      fieldName: string;
      maintenanceTypeId: number;
      newValue: unknown;
      oldValue: unknown;
      userId?: string | null;
    },
  ) {
    return tx.auditLog.create({
      data: {
        action: params.action,
        entityId: params.maintenanceTypeId,
        entityType: 'equipment_maintenance_type',
        fieldName: params.fieldName,
        module: AuditModule.EQUIPMENT,
        newValue: formatAuditValue(params.newValue),
        oldValue: formatAuditValue(params.oldValue),
        userId: params.userId ?? null,
      },
    });
  }
}

const maintenanceTypeSelect = {
  code: true,
  id: true,
  isActive: true,
  name: true,
} as const;

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}
