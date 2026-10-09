import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import { parseDictionaryName } from './dictionaries-admin.validation';

@Injectable()
export class ObjectsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listObjects() {
    return this.prisma.workshop.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createObject(payload: { name?: unknown }) {
    try {
      const name = parseDictionaryName(payload);
      return await this.prisma.workshop.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
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
      await this.prisma.workshop.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'OBJECT_NOT_FOUND');
    }
  }
}
