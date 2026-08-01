import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '@prisma/client';
import { BUSINESS_TIME_ZONE } from '../application/business-date';
import { PrismaService } from '../prisma/prisma.service';
import {
  EQUIPMENT_PROGRESS_RECENT_DAYS,
  EQUIPMENT_PROGRESS_TARGET_COUNT,
} from './equipment-progress-dashboard.constants';
import type {
  EquipmentProgressDashboardDto,
  EquipmentProgressDailyCountDto,
} from './equipment-progress-dashboard.types';

type EquipmentProgressItem = {
  commissioningDate: Date | null;
  countryId: number | null;
  inventoryNumber: string;
  issueDate: Date;
  manufactureYear: number | null;
  model: { manufacturerId: number | null };
  modelId: number;
  name: string;
  operationText: string | null;
  responsibleEmployeeId: number;
  sectionId: number;
  serialNumber: string | null;
  specifications: string | null;
  status: string;
  visibleId: number;
};

type MissingFieldRule = {
  isMissing: (equipment: EquipmentProgressItem) => boolean;
  label: string;
};

const missingFieldRules: MissingFieldRule[] = [
  {
    label: 'Название оборудования',
    isMissing: (equipment) => isBlank(equipment.name),
  },
  {
    label: 'Инвентарный номер',
    isMissing: (equipment) => isBlank(equipment.inventoryNumber),
  },
  {
    label: 'Производитель',
    isMissing: (equipment) => !equipment.model?.manufacturerId,
  },
  {
    label: 'Модель',
    isMissing: (equipment) => !equipment.modelId,
  },
  {
    label: 'Серийный номер',
    isMissing: (equipment) => isBlank(equipment.serialNumber),
  },
  {
    label: 'Технические характеристики',
    isMissing: (equipment) => isBlank(equipment.specifications),
  },
  {
    label: 'Страна',
    isMissing: (equipment) => !equipment.countryId,
  },
  {
    label: 'Год изготовления',
    isMissing: (equipment) => !equipment.manufactureYear,
  },
  {
    label: 'Дата ввода в эксплуатацию',
    isMissing: (equipment) => !equipment.commissioningDate,
  },
  {
    label: 'Дата выдачи',
    isMissing: (equipment) => !equipment.issueDate,
  },
  {
    label: 'Местонахождение',
    isMissing: (equipment) => !equipment.sectionId,
  },
  {
    label: 'Ответственный',
    isMissing: (equipment) => !equipment.responsibleEmployeeId,
  },
  {
    label: 'Статус',
    isMissing: (equipment) => isBlank(equipment.status),
  },
  {
    label: 'Эксплуатация',
    isMissing: (equipment) => isBlank(equipment.operationText),
  },
];

@Injectable()
export class EquipmentProgressDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(): Promise<EquipmentProgressDashboardDto> {
    const today = getBusinessDateId(new Date());
    const recentDates = getRecentDateIds(today, EQUIPMENT_PROGRESS_RECENT_DAYS);
    const periodStart = getBusinessDayStart(recentDates[0]);
    const periodEnd = getBusinessDayStart(addDays(today, 1));

    const [equipment, recentCreateAuditRows] = await Promise.all([
      this.prisma.equipment.findMany({
        orderBy: { visibleId: 'asc' },
        select: {
          commissioningDate: true,
          countryId: true,
          inventoryNumber: true,
          issueDate: true,
          manufactureYear: true,
          model: {
            select: {
              manufacturerId: true,
            },
          },
          modelId: true,
          name: true,
          operationText: true,
          responsibleEmployeeId: true,
          sectionId: true,
          serialNumber: true,
          specifications: true,
          status: true,
          visibleId: true,
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          entityId: true,
        },
        where: {
          action: AuditAction.CREATE,
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          entityId: {
            not: null,
          },
          entityType: 'equipment',
          module: AuditModule.EQUIPMENT,
        },
      }),
    ]);

    const incompleteEquipment = equipment
      .map((item) => ({
        missingFields: getMissingFields(item),
        name: item.name,
        visibleId: item.visibleId,
      }))
      .filter((item) => item.missingFields.length > 0);

    const recentDailyCounts = getRecentDailyCounts(
      recentDates,
      recentCreateAuditRows,
    );
    const recentCreatedCount = recentDailyCounts.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const rawAverageCreatedPerDay =
      recentCreatedCount / EQUIPMENT_PROGRESS_RECENT_DAYS;
    const averageCreatedPerDay = roundToSingleDecimal(rawAverageCreatedPerDay);
    const createdCount = equipment.length;
    const remainingCount = Math.max(
      EQUIPMENT_PROGRESS_TARGET_COUNT - createdCount,
      0,
    );
    const filledFieldsCount = equipment.reduce(
      (sum, item) =>
        sum + missingFieldRules.length - getMissingFields(item).length,
      0,
    );
    const totalExpectedFields =
      EQUIPMENT_PROGRESS_TARGET_COUNT * missingFieldRules.length;

    return {
      averageCreatedPerDay,
      completedCardsCount: createdCount - incompleteEquipment.length,
      createdCount,
      estimatedCompletionDate: getEstimatedCompletionDate({
        rawAverageCreatedPerDay,
        remainingCount,
        today,
      }),
      estimatedDaysRemaining:
        rawAverageCreatedPerDay > 0 && remainingCount > 0
          ? Math.ceil(remainingCount / rawAverageCreatedPerDay)
          : remainingCount === 0
            ? 0
            : null,
      incompleteCardsCount: incompleteEquipment.length,
      incompleteEquipment: incompleteEquipment.slice(0, 10),
      progressPercent: getProgressPercent(
        filledFieldsCount,
        totalExpectedFields,
      ),
      recentCreatedCount,
      recentDailyCounts,
      remainingCount,
      targetCount: EQUIPMENT_PROGRESS_TARGET_COUNT,
    };
  }
}

function getMissingFields(equipment: EquipmentProgressItem) {
  return missingFieldRules
    .filter((rule) => rule.isMissing(equipment))
    .map((rule) => rule.label);
}

function getProgressPercent(
  filledFieldsCount: number,
  totalExpectedFields: number,
) {
  if (totalExpectedFields <= 0) {
    return 100;
  }

  return Math.min(
    100,
    Math.round((filledFieldsCount / totalExpectedFields) * 100),
  );
}

function getRecentDailyCounts(
  dates: string[],
  auditRows: Array<{ createdAt: Date; entityId: number | null }>,
): EquipmentProgressDailyCountDto[] {
  const createdEquipmentIdsByDate = new Map<string, Set<number>>();

  dates.forEach((date) => {
    createdEquipmentIdsByDate.set(date, new Set());
  });

  auditRows.forEach((row) => {
    if (!row.entityId) {
      return;
    }

    const dateId = getBusinessDateId(row.createdAt);
    createdEquipmentIdsByDate.get(dateId)?.add(row.entityId);
  });

  return dates.map((date) => ({
    count: createdEquipmentIdsByDate.get(date)?.size ?? 0,
    date,
  }));
}

function getEstimatedCompletionDate(params: {
  remainingCount: number;
  rawAverageCreatedPerDay: number;
  today: string;
}) {
  if (params.remainingCount === 0) {
    return params.today;
  }

  if (params.rawAverageCreatedPerDay <= 0) {
    return null;
  }

  return addDays(
    params.today,
    Math.ceil(params.remainingCount / params.rawAverageCreatedPerDay),
  );
}

function getRecentDateIds(today: string, days: number) {
  return Array.from({ length: days }, (_, index) =>
    addDays(today, index - days + 1),
  );
}

function getBusinessDateId(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getBusinessDayStart(dateId: string) {
  const [year, month, day] = dateId.split('-').map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  const offsetMinutes = getTimeZoneOffsetMinutes(
    utcMidnight,
    BUSINESS_TIME_ZONE,
  );

  return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

function getTimeZoneOffsetMinutes(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const timeZoneDateAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return (timeZoneDateAsUtc - value.getTime()) / 60_000;
}

function addDays(dateId: string, days: number) {
  const date = new Date(`${dateId}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}
