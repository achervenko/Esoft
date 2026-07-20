import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentSearchProjector } from '../search/equipment-search.projector';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { getEquipmentAuditChanges } from './equipment-audit.mapper';
import { EQUIPMENT_IDENTITY_TARGET } from './equipment.constants';
import {
  buildEquipmentData,
  parseEquipmentVisibleId,
} from './equipment-data.mapper';
import { toEquipmentCard } from './equipment-presenter';
import { equipmentAuditInclude } from './equipment-relations';

@Injectable()
export class EquipmentWriteService {
  private readonly logger = new Logger(EquipmentWriteService.name);

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly equipmentSearchProjector: EquipmentSearchProjector,
    private readonly numbering: IdentityNumberingService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateEquipmentDto, userId?: string | null) {
    const nextVisibleId = parseEquipmentVisibleId(dto.visibleId);
    const data = buildEquipmentData(dto);

    if (nextVisibleId) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { visibleId: nextVisibleId },
        select: { id: true },
      });

      if (existingEquipment) {
        this.throwVisibleIdConflict();
      }
    }

    const equipment = await this.runEquipmentWrite(async (tx) => {
      await this.assertModelBelongsToManufacturer(
        tx,
        data.modelId,
        data.manufacturerId,
      );
      await this.assertResponsibleEmployeeIsActive(
        tx,
        data.responsibleEmployeeId,
      );

      const createdEquipment = await tx.equipment.create({
        data: {
          ...(nextVisibleId ? { visibleId: nextVisibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        createdEquipment.id,
      );

      await this.auditLog.logEquipmentCreated(createdEquipment.id, userId, tx);

      return createdEquipment;
    });

    if (nextVisibleId) {
      await this.syncEquipmentNumberingBestEffort();
    }

    return equipment;
  }

  async update(
    visibleId: number,
    dto: CreateEquipmentDto,
    userId?: string | null,
  ) {
    const nextVisibleId = parseEquipmentVisibleId(dto.visibleId);
    const data = buildEquipmentData(dto);

    const updatedEquipment = await this.runEquipmentWrite(async (tx) => {
      await this.assertModelBelongsToManufacturer(
        tx,
        data.modelId,
        data.manufacturerId,
      );
      await this.assertResponsibleEmployeeIsActive(
        tx,
        data.responsibleEmployeeId,
      );

      const lockedEquipment = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM equipment
        WHERE visible_id = ${visibleId}
        FOR UPDATE
      `;
      const equipmentId = lockedEquipment[0]?.id;

      if (!equipmentId) {
        throw new NotFoundException('Оборудование не найдено.');
      }

      const currentEquipment = await tx.equipment.findUnique({
        where: { id: equipmentId },
        include: equipmentAuditInclude,
      });

      if (!currentEquipment) {
        throw new NotFoundException('Оборудование не найдено.');
      }

      if (nextVisibleId && nextVisibleId !== currentEquipment.visibleId) {
        const existingEquipment = await tx.equipment.findUnique({
          where: { visibleId: nextVisibleId },
          select: { id: true },
        });

        if (existingEquipment) {
          this.throwVisibleIdConflict();
        }
      }

      await tx.equipment.update({
        where: { id: currentEquipment.id },
        data: {
          ...(nextVisibleId ? { visibleId: nextVisibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        currentEquipment.id,
      );

      const nextUpdatedEquipment = await tx.equipment.findUnique({
        where: { id: currentEquipment.id },
        include: equipmentAuditInclude,
      });

      if (!nextUpdatedEquipment) {
        throw new NotFoundException('Оборудование не найдено.');
      }

      await this.auditLog.logEquipmentUpdated({
        equipmentId: currentEquipment.id,
        lines: getEquipmentAuditChanges(currentEquipment, nextUpdatedEquipment),
        tx,
        userId,
      });

      return {
        equipment: nextUpdatedEquipment,
        shouldSyncNumbering:
          Boolean(nextVisibleId) &&
          nextVisibleId !== currentEquipment.visibleId,
      };
    });

    if (updatedEquipment.shouldSyncNumbering) {
      await this.syncEquipmentNumberingBestEffort();
    }

    return toEquipmentCard(updatedEquipment.equipment);
  }

  private async assertModelBelongsToManufacturer(
    tx: Prisma.TransactionClient,
    modelId: number,
    manufacturerId: number,
  ) {
    const models = await tx.$queryRaw<
      Array<{
        id: number;
        manufacturer_id: number;
        manufacturer_is_active: boolean;
        model_is_active: boolean;
      }>
    >`
      SELECT
        em.id,
        em.manufacturer_id,
        em.is_active AS model_is_active,
        m.is_active AS manufacturer_is_active
      FROM equipment_models em
      JOIN manufacturers m ON m.id = em.manufacturer_id
      WHERE em.id = ${modelId}
      FOR SHARE OF em, m
    `;
    const model = models[0];

    if (!model || model.manufacturer_id !== manufacturerId) {
      throw new BadRequestException(
        'Выберите модель выбранного производителя.',
      );
    }

    if (!model.model_is_active || !model.manufacturer_is_active) {
      throw new BadRequestException(
        'Выбранная модель или производитель отключены.',
      );
    }
  }

  private async assertResponsibleEmployeeIsActive(
    tx: Prisma.TransactionClient,
    employeeId: number | null | undefined,
  ) {
    if (!employeeId) {
      return;
    }

    const employees = await tx.$queryRaw<
      Array<{ id: number; is_active: boolean }>
    >`
      SELECT id, is_active
      FROM employees
      WHERE id = ${employeeId}
      FOR SHARE
    `;
    const employee = employees[0];

    if (!employee || !employee.is_active) {
      throw new BadRequestException({
        code: 'RESPONSIBLE_EMPLOYEE_INACTIVE',
        message: 'Выбранный ответственный сотрудник не найден или отключён.',
      });
    }
  }

  private async syncEquipmentNumberingBestEffort() {
    try {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    } catch (error) {
      this.logger.error(
        'Failed to sync equipment visible id sequence after equipment change',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async runEquipmentWrite<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      this.throwIfEquipmentUniqueConflict(error);
      throw error;
    }
  }

  private throwVisibleIdConflict(): never {
    throw new ConflictException({
      code: 'EQUIPMENT_ID_ALREADY_EXISTS',
      message: 'Оборудование с таким ID уже существует.',
    });
  }

  private throwInventoryNumberConflict(): never {
    throw new ConflictException({
      code: 'EQUIPMENT_INVENTORY_NUMBER_ALREADY_EXISTS',
      message: 'Оборудование с таким инвентарным номером уже существует.',
    });
  }

  private throwIfEquipmentUniqueConflict(error: unknown) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = this.getUniqueConflictTarget(error.meta?.target);

    if (
      this.hasAnyTarget(target, [
        'visible_id',
        'visibleId',
        'equipment_visible_id_key',
      ])
    ) {
      this.throwVisibleIdConflict();
    }

    if (
      this.hasAnyTarget(target, [
        'inventory_number',
        'inventoryNumber',
        'equipment_inventory_number_key',
      ])
    ) {
      this.throwInventoryNumberConflict();
    }
  }

  private getUniqueConflictTarget(target: unknown) {
    if (Array.isArray(target)) {
      return target.filter((item): item is string => typeof item === 'string');
    }

    return typeof target === 'string' ? [target] : [];
  }

  private hasAnyTarget(target: string[], values: string[]) {
    return values.some((value) => target.includes(value));
  }
}
