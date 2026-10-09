import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import { parseDictionaryName } from './dictionaries-admin.validation';

@Injectable()
export class ManufacturersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listManufacturers() {
    return this.prisma.manufacturer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createManufacturer(payload: { name?: unknown }) {
    try {
      const name = parseDictionaryName(payload);
      return await this.prisma.manufacturer.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
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
      await this.prisma.manufacturer.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'MANUFACTURER_NOT_FOUND');
    }
  }
}
