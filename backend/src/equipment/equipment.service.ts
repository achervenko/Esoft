import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditModule, StorageOwnerModule } from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentSearchProjector } from '../search/equipment-search.projector';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { getEquipmentAuditChanges, toAuditUserName } from './equipment-audit.mapper';
import { EQUIPMENT_IDENTITY_TARGET } from './equipment.constants';
import { buildEquipmentData } from './equipment-data.mapper';
import { toEquipmentCreateOptions } from './equipment-options.presenter';
import { equipmentAuditInclude } from './equipment-relations';
import { toEquipmentCard, toEquipmentListItem } from './equipment-presenter';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly equipmentSearchProjector: EquipmentSearchProjector,
    private readonly numbering: IdentityNumberingService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    const equipment = await this.prisma.equipment.findMany({
      include: {
        manufacturer: true,
        model: true,
      },
      orderBy: [{ visibleId: 'asc' }],
    });

    return equipment.map(toEquipmentListItem);
  }

  async getCreateOptions() {
    const [manufacturers, models, countries, sections, employees, nextVisibleId] =
      await Promise.all([
        this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.equipmentModel.findMany({
          orderBy: [{ manufacturer: { name: 'asc' } }, { name: 'asc' }],
        }),
        this.prisma.country.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.section.findMany({
          include: { workshop: true },
          orderBy: [{ workshop: { name: 'asc' } }, { name: 'asc' }],
        }),
        this.prisma.employee.findMany({
          orderBy: [
            { lastName: 'asc' },
            { firstName: 'asc' },
            { middleName: 'asc' },
          ],
        }),
        this.numbering.getNextId(EQUIPMENT_IDENTITY_TARGET),
      ]);

    return toEquipmentCreateOptions({
      nextVisibleId,
      manufacturers,
      models,
      countries,
      sections,
      employees,
    });
  }

  async findOneByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      include: equipmentAuditInclude,
    });

    if (!equipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    return toEquipmentCard(equipment);
  }

  async findHistoryByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      select: { id: true },
    });

    if (!equipment) {
      throw new NotFoundException(
        'РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ.',
      );
    }

    const history = await this.prisma.auditLog.findMany({
      where: {
        entityId: equipment.id,
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
      },
      include: {
        user: {
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return history.map((item) => ({
      id: item.id,
      action: item.action,
      createdAt: item.createdAt,
      fieldName: item.fieldName,
      newValue: item.newValue,
      oldValue: item.oldValue,
      timeZone: item.timeZone,
      user: item.user ? toAuditUserName(item.user) : 'РќРµ СѓРєР°Р·Р°РЅ',
    }));
  }

  async findStorageOwnerByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      select: { id: true },
    });

    if (!equipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    return {
      entityId: equipment.id,
      entityType: 'equipment',
      module: StorageOwnerModule.EQUIPMENT,
    };
  }

  async create(dto: CreateEquipmentDto, userId?: string | null) {
    const data = buildEquipmentData(dto);
    await this.assertModelBelongsToManufacturer(
      data.modelId,
      data.manufacturerId,
    );

    if (dto.visibleId) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { visibleId: dto.visibleId },
        select: { id: true },
      });

      if (existingEquipment) {
        throw new BadRequestException(
          'Оборудование с таким ID уже существует.',
        );
      }
    }

    const equipment = await this.prisma.$transaction(async (tx) => {
      const createdEquipment = await tx.equipment.create({
        data: {
          ...(dto.visibleId ? { visibleId: dto.visibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        createdEquipment.id,
      );

      return createdEquipment;
    });

    if (dto.visibleId) {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    }

    await this.auditLog.logEquipmentCreated(equipment.id, userId);

    return equipment;
  }

  async update(
    visibleId: number,
    dto: CreateEquipmentDto,
    userId?: string | null,
  ) {
    const currentEquipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      include: equipmentAuditInclude,
    });

    if (!currentEquipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    const data = buildEquipmentData(dto);
    await this.assertModelBelongsToManufacturer(
      data.modelId,
      data.manufacturerId,
    );

    if (dto.visibleId && dto.visibleId !== currentEquipment.visibleId) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { visibleId: dto.visibleId },
        select: { id: true },
      });

      if (existingEquipment) {
        throw new BadRequestException(
          'Оборудование с таким ID уже существует.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: currentEquipment.id },
        data: {
          ...(dto.visibleId ? { visibleId: dto.visibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        currentEquipment.id,
      );
    });

    if (dto.visibleId && dto.visibleId !== currentEquipment.visibleId) {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    }

    const updatedEquipment = await this.prisma.equipment.findUnique({
      where: { id: currentEquipment.id },
      include: equipmentAuditInclude,
    });

    if (!updatedEquipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    await this.auditLog.logEquipmentUpdated({
      equipmentId: currentEquipment.id,
      lines: getEquipmentAuditChanges(currentEquipment, updatedEquipment),
      userId,
    });

    return toEquipmentCard(updatedEquipment);
  }

  private async assertModelBelongsToManufacturer(
    modelId: number,
    manufacturerId: number,
  ) {
    const model = await this.prisma.equipmentModel.findUnique({
      where: { id: modelId },
      select: { manufacturerId: true },
    });

    if (!model || model.manufacturerId !== manufacturerId) {
      throw new BadRequestException(
        'Выберите модель выбранного производителя.',
      );
    }
  }
}
