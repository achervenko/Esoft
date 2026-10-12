import { Injectable } from '@nestjs/common';
import {
  equipmentProgressQuery,
  EQUIPMENT_CONTROLLED_FIELDS_COUNT,
  type EquipmentProgressSummary,
} from './equipment-progress-query';
import { BUSINESS_TIME_ZONE } from '../application/business-date';
import { PrismaService } from '../prisma/prisma.service';
import {
  EQUIPMENT_PROGRESS_RECENT_DAYS,
  EQUIPMENT_PROGRESS_TARGET_COUNT,
} from './equipment-progress-dashboard.constants';
import type { EquipmentProgressDashboardDto } from './equipment-progress-dashboard.types';

@Injectable()
export class EquipmentProgressDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(): Promise<EquipmentProgressDashboardDto> {
    const today = getBusinessDateId(new Date());
    const recentDates = getRecentDateIds(today, EQUIPMENT_PROGRESS_RECENT_DAYS);
    const periodStart = getBusinessDayStart(recentDates[0]);
    const periodEnd = getBusinessDayStart(addDays(today, 1));

    const [summary] = await this.prisma.$queryRaw<EquipmentProgressSummary[]>(
      equipmentProgressQuery(periodStart, periodEnd),
    );
    const dailyCounts = new Map(
      summary.recentDailyCounts.map((item) => [item.date, item.count]),
    );
    const recentDailyCounts = recentDates.map((date) => ({
      date,
      count: dailyCounts.get(date) ?? 0,
    }));
    const recentCreatedCount = recentDailyCounts.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const rawAverageCreatedPerDay =
      recentCreatedCount / EQUIPMENT_PROGRESS_RECENT_DAYS;
    const averageCreatedPerDay = roundToSingleDecimal(rawAverageCreatedPerDay);
    const createdCount = summary.createdCount;
    const remainingCount = Math.max(
      EQUIPMENT_PROGRESS_TARGET_COUNT - createdCount,
      0,
    );
    const filledFieldsCount = summary.filledFieldsCount;
    const totalExpectedFields =
      EQUIPMENT_PROGRESS_TARGET_COUNT * EQUIPMENT_CONTROLLED_FIELDS_COUNT;

    return {
      averageCreatedPerDay,
      completedCardsCount: createdCount - summary.incompleteCardsCount,
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
      incompleteCardsCount: summary.incompleteCardsCount,
      incompleteEquipment: summary.incompleteEquipment,
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
