import {
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
import { EquipmentReferenceValidatorService } from './equipment-reference-validator.service';
import { equipmentAuditInclude } from './equipment-relations';
import {
  throwIfEquipmentUniqueConflict,
  throwVisibleIdConflict,
} from './equipment-write.errors';

@Injectable()
export class EquipmentWriteService {
  private readonly logger = new Logger(EquipmentWriteService.name);

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly equipmentSearchProjector: EquipmentSearchProjector,
    private readonly numbering: IdentityNumberingService,
    private readonly prisma: PrismaService,
    private readonly referenceValidator: EquipmentReferenceValidatorService,
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
        throwVisibleIdConflict();
      }
    }

    const equipment = await this.runEquipmentWrite(async (tx) => {
      await this.referenceValidator.assertEquipmentModelExists(tx, data.modelId);
      await this.referenceValidator.assertSectionExists(tx, data.sectionId);
      await this.referenceValidator.assertCountryExists(tx, data.countryId);
      await this.referenceValidator.assertResponsibleEmployeeIsActive(
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

      const equipmentWithRelations = await tx.equipment.findUnique({
        where: { id: createdEquipment.id },
        include: equipmentAuditInclude,
      });

      if (!equipmentWithRelations) {
        throw new NotFoundException('Оборудование не найдено.');
      }

      return equipmentWithRelations;
    });

    if (nextVisibleId) {
      await this.syncEquipmentNumberingBestEffort();
    }

    return toEquipmentCard(equipment);
  }

  async update(
    visibleId: number,
    dto: CreateEquipmentDto,
    userId?: string | null,
  ) {
    const nextVisibleId = parseEquipmentVisibleId(dto.visibleId);
    const data = buildEquipmentData(dto);

    const updatedEquipment = await this.runEquipmentWrite(async (tx) => {
      await this.referenceValidator.assertEquipmentModelExists(tx, data.modelId);
      await this.referenceValidator.assertSectionExists(tx, data.sectionId);
      await this.referenceValidator.assertCountryExists(tx, data.countryId);
      await this.referenceValidator.assertResponsibleEmployeeIsActive(
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
          throwVisibleIdConflict();
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
      throwIfEquipmentUniqueConflict(error);
      throw error;
    }
  }
}
