import { BadRequestException, Injectable } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

const EQUIPMENT_IDENTITY_TARGET = {
  tableName: 'equipment',
  columnName: 'id',
};

@Injectable()
export class EquipmentService {
  constructor(
    private readonly numbering: IdentityNumberingService,
    private readonly prisma: PrismaService,
  ) {}

  async getCreateOptions() {
    const [manufacturers, countries, sections, employees, nextId] =
      await Promise.all([
        this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } }),
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

    return {
      nextId,
      manufacturers: manufacturers.map(({ id, name }) => ({ id, name })),
      countries: countries.map(({ id, name }) => ({ id, name })),
      sections: sections.map((section) => ({
        id: section.id,
        name: `${section.workshop.name} / ${section.name}`,
      })),
      employees: employees.map((employee) => ({
        id: employee.id,
        name: [
          employee.lastName,
          employee.firstName,
          employee.middleName,
        ]
          .filter(Boolean)
          .join(' '),
        position: employee.position,
      })),
      statuses: [
        { value: EquipmentStatus.ACTIVE, label: 'В эксплуатации' },
        { value: EquipmentStatus.RESERVE, label: 'Резерв' },
        { value: EquipmentStatus.REPAIR, label: 'В ремонте' },
        { value: EquipmentStatus.MAINTENANCE, label: 'На обслуживании' },
        { value: EquipmentStatus.WRITTEN_OFF, label: 'Списано' },
      ],
    };
  }

  async create(dto: CreateEquipmentDto) {
    const name = dto.name?.trim();
    const inventoryNumber = dto.inventoryNumber?.trim();

    if (!name) {
      throw new BadRequestException('Название оборудования обязательно.');
    }

    if (!inventoryNumber) {
      throw new BadRequestException('Инвентарный номер обязателен.');
    }

    if (!dto.sectionId) {
      throw new BadRequestException('Участок обязателен.');
    }

    if (!dto.responsibleEmployeeId) {
      throw new BadRequestException('Ответственный обязателен.');
    }

    if (!dto.status) {
      throw new BadRequestException('Статус обязателен.');
    }

    if (dto.id) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { id: dto.id },
        select: { id: true },
      });

      if (existingEquipment) {
        throw new BadRequestException('Оборудование с таким ID уже существует.');
      }
    }

    const equipment = await this.prisma.equipment.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        name,
        inventoryNumber,
        serialNumber: this.toSerialNumber(dto.serialNumber),
        model: this.toNullableText(dto.model),
        specifications: this.toNullableText(dto.specifications),
        manufacturerId: this.toNullableNumber(dto.manufacturerId),
        countryId: this.toNullableNumber(dto.countryId),
        manufactureYear: this.toNullableNumber(dto.manufactureYear),
        commissioningDate: this.parseRuDate(dto.commissioningDate),
        sectionId: dto.sectionId,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        status: dto.status,
        operationText: this.toNullableText(dto.operationText),
        notes: this.toNullableText(dto.notes),
      },
    });

    if (dto.id) {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    }

    return equipment;
  }

  private toNullableText(value: string | null | undefined) {
    const cleanValue = value?.trim();
    return cleanValue ? cleanValue : null;
  }

  private toSerialNumber(value: string | null | undefined) {
    const cleanValue = value?.trim();
    return cleanValue ? cleanValue : 'б/н';
  }

  private toNullableNumber(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private parseRuDate(value: string | null | undefined) {
    const cleanValue = value?.trim();

    if (!cleanValue) {
      return null;
    }

    const match = cleanValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (!match) {
      throw new BadRequestException('Дата должна быть в формате ДД.ММ.ГГГГ.');
    }

    const [, day, month, year] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

}
