import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.assertManufacturerExists(data.manufacturerId);

    try {
      return await this.prisma.equipmentModel.create({
        data,
        include: { manufacturer: true },
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
    await this.assertManufacturerExists(data.manufacturerId);

    try {
      return await this.prisma.equipmentModel.update({
        data,
        include: { manufacturer: true },
        where: { id },
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
    await this.assertObjectExists(data.workshopId);

    try {
      return await this.prisma.section.create({
        data,
        include: { workshop: true },
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
    await this.assertObjectExists(data.workshopId);

    try {
      return await this.prisma.section.update({
        data,
        include: { workshop: true },
        where: { id },
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

  private async assertObjectExists(id: number) {
    const object = await this.prisma.workshop.findUnique({ where: { id } });

    if (!object) {
      throw new NotFoundException({
        code: 'OBJECT_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }

  private async assertManufacturerExists(id: number) {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
    });

    if (!manufacturer) {
      throw new NotFoundException({
        code: 'MANUFACTURER_NOT_FOUND',
        message: 'Запись не найдена.',
      });
    }
  }
}
