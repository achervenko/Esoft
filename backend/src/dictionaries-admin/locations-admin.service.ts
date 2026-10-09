import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import { parseLocationPayload } from './dictionaries-admin.validation';

@Injectable()
export class LocationsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listLocations() {
    return this.prisma.section.findMany({
      where: { isActive: true, workshop: { isActive: true } },
      include: { workshop: true },
      orderBy: [{ workshop: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createLocation(payload: { name?: unknown; objectId?: unknown }) {
    const data = parseLocationPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertObjectExists(data.workshopId, tx);

        return tx.section.upsert({
          where: { workshopId_name: data },
          create: data,
          update: { isActive: true },
          include: { workshop: true },
        });
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'LOCATION_NOT_FOUND');
    }
  }

  async updateLocation(
    id: number,
    payload: { name?: unknown; objectId?: unknown },
  ) {
    const data = parseLocationPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertObjectExists(data.workshopId, tx);

        return tx.section.update({
          data,
          include: { workshop: true },
          where: { id },
        });
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'LOCATION_NOT_FOUND');
    }
  }

  async deleteLocation(id: number) {
    try {
      await this.prisma.section.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'LOCATION_NOT_FOUND');
    }
  }

  private async assertObjectExists(id: number, tx: Prisma.TransactionClient) {
    const objects = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM workshops
      WHERE id = ${id} AND is_active = true
      FOR SHARE
    `;

    if (!objects[0]) {
      throw new NotFoundException({
        code: 'OBJECT_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }
}
