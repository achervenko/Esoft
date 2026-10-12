import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StorageOwnerModule } from '@prisma/client';
import {
  parseEquipmentListQuery,
  type EquipmentListQuery,
} from './equipment-list-query';
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

  async findAll(query: EquipmentListQuery = {}) {
    const { page, limit, skip, order } = parseEquipmentListQuery(query);
    const total = await this.prisma.equipment.count();
    if (skip >= total) return { items: [], total, page, limit };
    const ids = await this.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT e.id FROM equipment e
      JOIN equipment_models model ON model.id = e.model_id
      JOIN manufacturers manufacturer ON manufacturer.id = model.manufacturer_id
      ORDER BY ${order} LIMIT ${limit} OFFSET ${skip}
    `);
    if (ids.length === 0) return { items: [], total, page, limit };
    const equipment = await this.prisma.equipment.findMany({
      where: { id: { in: ids.map((item) => item.id) } },
      select: {
        id: true,
        inventoryNumber: true,
        model: {
          select: {
            name: true,
            manufacturer: {
              select: {
                name: true,
              },
            },
          },
        },
        name: true,
        serialNumber: true,
        status: true,
        visibleId: true,
      },
    });

    const byId = new Map(
      equipment.map((item) => [item.id, toEquipmentListItem(item)]),
    );
    return {
      items: ids.flatMap(({ id }) => {
        const item = byId.get(id);
        return item ? [item] : [];
      }),
      total,
      page,
      limit,
    };
  }

  async getCreateOptions(visibleId?: number) {
    const current =
      visibleId === undefined
        ? null
        : await this.prisma.equipment.findUnique({
            where: { visibleId },
            select: {
              modelId: true,
              countryId: true,
              sectionId: true,
              responsibleEmployeeId: true,
              model: { select: { manufacturerId: true } },
            },
          });
    if (visibleId !== undefined && !current)
      throw new NotFoundException('Оборудование не найдено.');
    const [
      manufacturers,
      models,
      countries,
      sections,
      employees,
      nextVisibleId,
    ] = await Promise.all([
      this.prisma.manufacturer.findMany({
        where: {
          OR: [
            { isActive: true },
            ...(current ? [{ id: current.model.manufacturerId }] : []),
          ],
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.equipmentModel.findMany({
        where: {
          OR: [
            { isActive: true, manufacturer: { isActive: true } },
            ...(current ? [{ id: current.modelId }] : []),
          ],
        },
        orderBy: [{ manufacturer: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.country.findMany({
        where: {
          OR: [
            { isActive: true },
            ...(current?.countryId ? [{ id: current.countryId }] : []),
          ],
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.section.findMany({
        where: {
          OR: [
            { isActive: true, workshop: { isActive: true } },
            ...(current ? [{ id: current.sectionId }] : []),
          ],
        },
        include: { workshop: true },
        orderBy: [{ workshop: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.employee.findMany({
        include: { position: true },
        where: {
          OR: [
            { isActive: true },
            ...(current ? [{ id: current.responsibleEmployeeId }] : []),
          ],
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
          { middleName: 'asc' },
        ],
      }),
      visibleId === undefined
        ? this.numbering.getNextId(EQUIPMENT_IDENTITY_TARGET)
        : Promise.resolve(visibleId),
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
