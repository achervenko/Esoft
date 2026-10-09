import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwDictionaryPrismaError } from './dictionaries-admin.errors';
import { parseCountryPayload } from './dictionaries-admin.validation';

@Injectable()
export class CountriesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listCountries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCountry(payload: { iso?: unknown; name?: unknown }) {
    try {
      const data = parseCountryPayload(payload);
      return await this.prisma.$transaction(async (tx) => {
        const matches = await tx.$queryRaw<
          Array<{ id: number; name: string; iso: string }>
        >`
          SELECT id, name, iso FROM countries
          WHERE name = ${data.name} OR iso = ${data.iso}
          ORDER BY id FOR UPDATE
        `;
        if (
          matches.some(
            (country) => country.name !== data.name || country.iso !== data.iso,
          )
        ) {
          throw new ConflictException({
            code: 'DICTIONARY_ITEM_ALREADY_EXISTS',
            message: 'Название или ISO уже используются другой страной.',
          });
        }
        // The unique constraints and final identity check also protect concurrent creates.
        const country = await tx.country.upsert({
          where: { iso: data.iso },
          create: data,
          update: { isActive: true },
        });
        if (country.name !== data.name)
          throw new ConflictException({
            code: 'DICTIONARY_ITEM_ALREADY_EXISTS',
            message: 'Название или ISO уже используются другой страной.',
          });
        return country;
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
      await this.prisma.country.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true };
    } catch (error) {
      throwDictionaryPrismaError(error, 'COUNTRY_NOT_FOUND');
    }
  }
}
