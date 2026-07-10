import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

const EQUIPMENT_IDENTITY_TARGET = {
  tableName: 'equipment',
  columnName: 'visible_id',
};

@Injectable()
export class EquipmentService {
  constructor(
    private readonly numbering: IdentityNumberingService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    const equipment = await this.prisma.equipment.findMany({
      include: {
        manufacturer: true,
      },
      orderBy: [{ visibleId: 'asc' }],
    });

    return equipment.map((item) => ({
      id: item.id,
      visibleId: item.visibleId,
      name: item.name,
      inventoryNumber: item.inventoryNumber,
      serialNumber: item.serialNumber,
      manufacturer: item.manufacturer?.name ?? 'Не указан',
      model: item.model ?? 'Не указана',
      status: item.status,
      statusLabel: this.getStatusLabel(item.status),
    }));
  }

  async getCreateOptions() {
    const [manufacturers, countries, sections, employees, nextVisibleId] =
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
      nextVisibleId,
      manufacturers: manufacturers.map(({ id, name }) => ({ id, name })),
      countries: countries.map(({ id, name }) => ({ id, name })),
      sections: sections.map((section) => ({
        id: section.id,
        name: `${section.workshop.name} / ${section.name}`,
      })),
      employees: employees.map((employee) => ({
        id: employee.id,
        name: [employee.lastName, employee.firstName, employee.middleName]
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

  async findOneByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      include: {
        country: true,
        manufacturer: true,
        responsibleEmployee: true,
        section: {
          include: {
            workshop: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    return {
      id: equipment.id,
      visibleId: equipment.visibleId,
      name: equipment.name,
      inventoryNumber: equipment.inventoryNumber,
      serialNumber: equipment.serialNumber,
      manufacturer: equipment.manufacturer?.name ?? 'Не указан',
      model: equipment.model ?? 'Не указана',
      specifications: equipment.specifications,
      country: equipment.country?.name ?? 'Не указана',
      manufactureYear: equipment.manufactureYear,
      commissioningDate: equipment.commissioningDate,
      issueDate: equipment.issueDate,
      location: `${equipment.section.workshop.name} / ${equipment.section.name}`,
      responsible: [
        equipment.responsibleEmployee.lastName,
        equipment.responsibleEmployee.firstName,
        equipment.responsibleEmployee.middleName,
      ]
        .filter(Boolean)
        .join(' '),
      responsiblePosition: equipment.responsibleEmployee.position,
      status: equipment.status,
      statusLabel: this.getStatusLabel(equipment.status),
      operationText: equipment.operationText,
      notes: equipment.notes,
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

    if (dto.responsibleEmployeeId && !dto.issueDate?.trim()) {
      throw new BadRequestException(
        'Дата выдачи обязательна при назначении ответственного.',
      );
    }

    if (!dto.status) {
      throw new BadRequestException('Статус обязателен.');
    }

    if (dto.visibleId) {
      const existingEquipment = await this.prisma.equipment.findUnique({
        where: { visibleId: dto.visibleId },
        select: { id: true },
      });

      if (existingEquipment) {
        throw new BadRequestException(
          'Оборудование с таким ID уже существует.',
        );
      }
    }

    const equipment = await this.prisma.equipment.create({
      data: {
        ...(dto.visibleId ? { visibleId: dto.visibleId } : {}),
        name,
        inventoryNumber,
        serialNumber: this.toSerialNumber(dto.serialNumber),
        model: this.toNullableText(dto.model),
        specifications: this.toNullableText(dto.specifications),
        manufacturerId: this.toNullableNumber(dto.manufacturerId),
        countryId: this.toNullableNumber(dto.countryId),
        manufactureYear: this.toNullableNumber(dto.manufactureYear),
        commissioningDate: this.parseRuDate(dto.commissioningDate),
        issueDate: this.parseRuDate(dto.issueDate),
        sectionId: dto.sectionId,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        status: dto.status,
        operationText: this.toNullableText(dto.operationText),
        notes: this.toNullableText(dto.notes),
      },
    });

    if (dto.visibleId) {
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

  private getStatusLabel(status: EquipmentStatus) {
    const statusLabels: Record<EquipmentStatus, string> = {
      [EquipmentStatus.ACTIVE]: 'В эксплуатации',
      [EquipmentStatus.RESERVE]: 'Резерв',
      [EquipmentStatus.REPAIR]: 'В ремонте',
      [EquipmentStatus.MAINTENANCE]: 'На обслуживании',
      [EquipmentStatus.WRITTEN_OFF]: 'Списано',
    };

    return statusLabels[status];
  }
}
