import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import {
  parseCountryPayload,
  parseDictionaryName,
  parseEquipmentModelPayload,
  parseLocationPayload,
} from './dictionaries-admin.validation';

@Injectable()
export class DictionariesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  getOverview() {
    return {
      dictionaries: [],
    };
  }

  listManufacturers() {
    return this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  }

  async createManufacturer(payload: { name?: unknown }) {
    try {
      return await this.prisma.manufacturer.create({
        data: { name: parseDictionaryName(payload) },
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'MANUFACTURER_NOT_FOUND');
    }
  }

  async updateManufacturer(id: number, payload: { name?: unknown }) {
    try {
      return await this.prisma.manufacturer.update({
        data: { name: parseDictionaryName(payload) },
        where: { id },
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'MANUFACTURER_NOT_FOUND');
    }
  }

  async deleteManufacturer(id: number) {
    try {
      await this.prisma.manufacturer.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'MANUFACTURER_NOT_FOUND');
    }
  }

  listEquipmentModels() {
    return this.prisma.equipmentModel.findMany({
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

        return tx.equipmentModel.create({
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
      await this.prisma.equipmentModel.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'EQUIPMENT_MODEL_NOT_FOUND');
    }
  }

  listCountries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  async createCountry(payload: { iso?: unknown; name?: unknown }) {
    try {
      return await this.prisma.country.create({
        data: parseCountryPayload(payload),
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'COUNTRY_NOT_FOUND');
    }
  }

  async updateCountry(id: number, payload: { iso?: unknown; name?: unknown }) {
    try {
      return await this.prisma.country.update({
        data: parseCountryPayload(payload),
        where: { id },
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'COUNTRY_NOT_FOUND');
    }
  }

  async deleteCountry(id: number) {
    try {
      await this.prisma.country.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'COUNTRY_NOT_FOUND');
    }
  }

  listObjects() {
    return this.prisma.workshop.findMany({ orderBy: { name: 'asc' } });
  }

  async createObject(payload: { name?: unknown }) {
    try {
      return await this.prisma.workshop.create({
        data: { name: parseDictionaryName(payload) },
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'OBJECT_NOT_FOUND');
    }
  }

  async updateObject(id: number, payload: { name?: unknown }) {
    try {
      return await this.prisma.workshop.update({
        data: { name: parseDictionaryName(payload) },
        where: { id },
      });
    } catch (error) {
      throwDictionaryPrismaError(error, 'OBJECT_NOT_FOUND');
    }
  }

  async deleteObject(id: number) {
    try {
      await this.prisma.workshop.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'OBJECT_NOT_FOUND');
    }
  }

  listLocations() {
    return this.prisma.section.findMany({
      include: { workshop: true },
      orderBy: [{ workshop: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createLocation(payload: { name?: unknown; objectId?: unknown }) {
    const data = parseLocationPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertObjectExists(data.workshopId, tx);

        return tx.section.create({
          data,
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
      await this.prisma.section.delete({ where: { id } });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'LOCATION_NOT_FOUND');
    }
  }

  private async assertObjectExists(id: number, tx: Prisma.TransactionClient) {
    const objects = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM workshops
      WHERE id = ${id}
      FOR SHARE
    `;

    if (!objects[0]) {
      throw new NotFoundException({
        code: 'OBJECT_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }

  private async assertManufacturerExists(
    id: number,
    tx: Prisma.TransactionClient,
  ) {
    const manufacturers = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM manufacturers
      WHERE id = ${id}
      FOR SHARE
    `;

    if (!manufacturers[0]) {
      throw new NotFoundException({
        code: 'MANUFACTURER_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }
}
