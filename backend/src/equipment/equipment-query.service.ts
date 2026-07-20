import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageOwnerModule } from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { EQUIPMENT_IDENTITY_TARGET } from './equipment.constants';
import { toEquipmentCreateOptions } from './equipment-options.presenter';
import { equipmentAuditInclude } from './equipment-relations';
import { toEquipmentCard, toEquipmentListItem } from './equipment-presenter';

@Injectable()
export class EquipmentQueryService {
  constructor(
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
    const [
      manufacturers,
      models,
      countries,
      sections,
      employees,
      nextVisibleId,
    ] = await Promise.all([
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
        where: {
          isActive: true,
        },
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
}
