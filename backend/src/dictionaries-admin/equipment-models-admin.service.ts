import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import { parseEquipmentModelPayload } from './dictionaries-admin.validation';

@Injectable()
export class EquipmentModelsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listEquipmentModels() {
    return this.prisma.equipmentModel.findMany({
      where: { isActive: true, manufacturer: { isActive: true } },
      include: { manufacturer: true },
      orderBy: [{ manufacturer: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createEquipmentModel(payload: {
    manufacturerId?: unknown;
    name?: unknown;
  }) {
    const data = parseEquipmentModelPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertManufacturerExists(data.manufacturerId, tx);

        const previous = await tx.equipmentModel.findFirst({
          where: {
            manufacturerId: data.manufacturerId,
            name: { equals: data.name, mode: 'insensitive' },
          },
          orderBy: { id: 'asc' },
        });
        return previous
          ? tx.equipmentModel.update({
              where: { id: previous.id },
              data: { isActive: true },
              include: { manufacturer: true },
            })
          : tx.equipmentModel.create({
              data,
              include: { manufacturer: true },
            });
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'EQUIPMENT_MODEL_NOT_FOUND');
    }
  }

  async updateEquipmentModel(
    id: number,
    payload: { manufacturerId?: unknown; name?: unknown },
  ) {
    const data = parseEquipmentModelPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertManufacturerExists(data.manufacturerId, tx);

        const duplicate = await tx.equipmentModel.findFirst({
          where: {
            manufacturerId: data.manufacturerId,
            name: { equals: data.name, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new ConflictException({
            code: 'DICTIONARY_ITEM_ALREADY_EXISTS',
            message: 'Такая модель уже существует.',
          });
        }
        return tx.equipmentModel.update({
          data,
          include: { manufacturer: true },
          where: { id },
        });
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'EQUIPMENT_MODEL_NOT_FOUND');
    }
  }

  async deleteEquipmentModel(id: number) {
    try {
      await this.prisma.equipmentModel.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'EQUIPMENT_MODEL_NOT_FOUND');
    }
  }

  private async assertManufacturerExists(
    id: number,
    tx: Prisma.TransactionClient,
  ) {
    const manufacturers = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM manufacturers
      WHERE id = ${id} AND is_active = true
      FOR UPDATE
    `;

    if (!manufacturers[0]) {
      throw new NotFoundException({
        code: 'MANUFACTURER_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }
}
