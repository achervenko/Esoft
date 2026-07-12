import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditModule,
  EquipmentStatus,
  Prisma,
  StorageOwnerModule,
} from '@prisma/client';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentSearchProjector } from '../search/equipment-search.projector';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

const EQUIPMENT_IDENTITY_TARGET = {
  tableName: 'equipment',
  columnName: 'visible_id',
};

const equipmentAuditInclude = {
  country: true,
  manufacturer: true,
  responsibleEmployee: true,
  section: {
    include: {
      workshop: true,
    },
  },
} as const;

type EquipmentWithAuditRelations = Prisma.EquipmentGetPayload<{
  include: typeof equipmentAuditInclude;
}>;

@Injectable()
export class EquipmentService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly equipmentSearchProjector: EquipmentSearchProjector,
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
      include: equipmentAuditInclude,
    });

    if (!equipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    return this.toEquipmentCard(equipment);
  }

  async findHistoryByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      select: { id: true },
    });

    if (!equipment) {
      throw new NotFoundException(
        'РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ.',
      );
    }

    const history = await this.prisma.auditLog.findMany({
      where: {
        entityId: equipment.id,
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
      },
      include: {
        user: {
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return history.map((item) => ({
      id: item.id,
      action: item.action,
      createdAt: item.createdAt,
      fieldName: item.fieldName,
      newValue: item.newValue,
      oldValue: item.oldValue,
      timeZone: item.timeZone,
      user: item.user ? this.toAuditUserName(item.user) : 'РќРµ СѓРєР°Р·Р°РЅ',
    }));
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

  async create(dto: CreateEquipmentDto, userId?: string | null) {
    const data = this.toEquipmentData(dto);

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

    const equipment = await this.prisma.$transaction(async (tx) => {
      const createdEquipment = await tx.equipment.create({
        data: {
          ...(dto.visibleId ? { visibleId: dto.visibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        createdEquipment.id,
      );

      return createdEquipment;
    });

    if (dto.visibleId) {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    }

    await this.auditLog.logEquipmentCreated(equipment.id, userId);

    return equipment;
  }

  async update(
    visibleId: number,
    dto: CreateEquipmentDto,
    userId?: string | null,
  ) {
    const currentEquipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      include: equipmentAuditInclude,
    });

    if (!currentEquipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    const data = this.toEquipmentData(dto);

    if (dto.visibleId && dto.visibleId !== currentEquipment.visibleId) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.equipment.update({
        where: { id: currentEquipment.id },
        data: {
          ...(dto.visibleId ? { visibleId: dto.visibleId } : {}),
          ...data,
        },
      });

      await this.equipmentSearchProjector.upsertEquipment(
        tx,
        currentEquipment.id,
      );
    });

    if (dto.visibleId && dto.visibleId !== currentEquipment.visibleId) {
      await this.numbering.syncSequence(EQUIPMENT_IDENTITY_TARGET);
    }

    const updatedEquipment = await this.prisma.equipment.findUnique({
      where: { id: currentEquipment.id },
      include: equipmentAuditInclude,
    });

    if (!updatedEquipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    await this.auditLog.logEquipmentUpdated({
      equipmentId: currentEquipment.id,
      lines: this.getEquipmentAuditChanges(currentEquipment, updatedEquipment),
      userId,
    });

    return this.toEquipmentCard(updatedEquipment);
  }

  private toEquipmentData(dto: CreateEquipmentDto) {
    const name = dto.name?.trim();
    const inventoryNumber = dto.inventoryNumber?.trim();

    if (!name) {
      throw new BadRequestException('Название оборудования обязательно.');
    }

    if (!inventoryNumber) {
      throw new BadRequestException('Инвентарный номер обязателен.');
    }

    if (!dto.sectionId) {
      throw new BadRequestException('Местонахождение обязательно.');
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

    const manufactureYear = this.toNullableNumber(dto.manufactureYear);
    const commissioningDate = this.parseRuDate(dto.commissioningDate);
    const issueDate = this.parseRuDate(dto.issueDate);

    if (
      manufactureYear &&
      commissioningDate &&
      commissioningDate.getUTCFullYear() < manufactureYear
    ) {
      throw new BadRequestException(
        'Год ввода в эксплуатацию не может быть меньше года выпуска.',
      );
    }

    if (issueDate && commissioningDate && issueDate < commissioningDate) {
      throw new BadRequestException(
        'Дата выдачи не может быть раньше даты ввода в эксплуатацию.',
      );
    }

    return {
      name,
      inventoryNumber,
      serialNumber: this.toSerialNumber(dto.serialNumber),
      model: this.toNullableText(dto.model),
      specifications: this.toNullableText(dto.specifications),
      manufacturerId: this.toNullableNumber(dto.manufacturerId),
      countryId: this.toNullableNumber(dto.countryId),
      manufactureYear,
      commissioningDate,
      issueDate,
      sectionId: dto.sectionId,
      responsibleEmployeeId: dto.responsibleEmployeeId,
      status: dto.status,
      operationText: this.toNullableText(dto.operationText),
      notes: this.toNullableText(dto.notes),
    };
  }

  private toEquipmentCard(equipment: EquipmentWithAuditRelations) {
    return {
      id: equipment.id,
      visibleId: equipment.visibleId,
      name: equipment.name,
      inventoryNumber: equipment.inventoryNumber,
      serialNumber: equipment.serialNumber,
      manufacturerId: equipment.manufacturerId,
      manufacturer: equipment.manufacturer?.name ?? 'Не указан',
      model: equipment.model ?? 'Не указана',
      specifications: equipment.specifications,
      countryId: equipment.countryId,
      country: equipment.country?.name ?? 'Не указана',
      manufactureYear: equipment.manufactureYear,
      commissioningDate: equipment.commissioningDate,
      issueDate: equipment.issueDate,
      sectionId: equipment.sectionId,
      location: `${equipment.section.workshop.name} / ${equipment.section.name}`,
      responsibleEmployeeId: equipment.responsibleEmployeeId,
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

  private toAuditUserName(
    user: Prisma.UserGetPayload<{
      include: {
        employeeUser: {
          include: {
            employee: true;
          };
        };
      };
    }>,
  ) {
    const employee = user.employeeUser?.employee;

    if (employee) {
      return [employee.lastName, employee.firstName, employee.middleName]
        .filter(Boolean)
        .join(' ');
    }

    return (
      user.displayUsername ||
      user.username ||
      user.name ||
      'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'
    );
  }

  private getEquipmentAuditChanges(
    oldEquipment: EquipmentWithAuditRelations,
    newEquipment: EquipmentWithAuditRelations,
  ) {
    const oldValues = this.toEquipmentAuditValues(oldEquipment);
    const newValues = this.toEquipmentAuditValues(newEquipment);

    return Object.entries(newValues)
      .filter(([key, newValue]) => oldValues[key] !== newValue)
      .map(([fieldLabel, newValue]) => ({
        fieldLabel,
        oldValue: oldValues[fieldLabel],
        newValue,
      }));
  }

  private toEquipmentAuditValues(
    equipment: EquipmentWithAuditRelations,
  ): Record<string, string | null> {
    return {
      ID: String(equipment.visibleId),
      'Название оборудования': equipment.name,
      Производитель: equipment.manufacturer?.name ?? null,
      Модель: equipment.model,
      'Технические характеристики': equipment.specifications,
      'Заводской номер': equipment.serialNumber,
      'Инвентарный номер': equipment.inventoryNumber,
      'Страна производства': equipment.country?.name ?? null,
      'Год выпуска': this.toNullableAuditValue(equipment.manufactureYear),
      'Дата ввода в эксплуатацию': this.formatDateForAudit(
        equipment.commissioningDate,
      ),
      'Дата выдачи': this.formatDateForAudit(equipment.issueDate),
      Местонахождение: `${equipment.section.workshop.name} / ${equipment.section.name}`,
      Ответственный: [
        equipment.responsibleEmployee.lastName,
        equipment.responsibleEmployee.firstName,
        equipment.responsibleEmployee.middleName,
      ]
        .filter(Boolean)
        .join(' '),
      Статус: this.getStatusLabel(equipment.status),
      'Технологическая операция': equipment.operationText,
      Примечание: equipment.notes,
    };
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

  private toNullableAuditValue(value: number | string | null | undefined) {
    return value === null || value === undefined ? null : String(value);
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

  private formatDateForAudit(value: Date | null) {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat('ru-RU').format(value);
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
