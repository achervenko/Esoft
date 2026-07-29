import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CALENDAR_END_DATE,
  CALENDAR_EXPECTED_DAYS,
  CALENDAR_MAX_HOLES,
  CALENDAR_START_DATE,
} from './calendar.constants';
import { calendarDaySelect, type CalendarDayRecord } from './calendar.select';
import type {
  CalendarIntegrityRepositoryReport,
  CalendarWorkdayData,
} from './calendar.types';
import { PrismaService } from '../prisma/prisma.service';

type CalendarIntegritySummaryRow = {
  dateDuplicates: bigint;
  missingWorkdays: bigint;
  orphanWorkdays: bigint;
  totalDays: bigint;
  totalWorkdays: bigint;
};

type CalendarHoleRow = {
  date: Date;
};

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  findDay(
    date: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CalendarDayRecord | null> {
    return tx.calendarDay.findUnique({
      select: calendarDaySelect,
      where: { date },
    });
  }

  findRange(dateFrom: Date, dateTo: Date): Promise<CalendarDayRecord[]> {
    return this.prisma.calendarDay.findMany({
      orderBy: { date: 'asc' },
      select: calendarDaySelect,
      where: {
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });
  }

  updateWorkday(
    date: Date,
    workday: CalendarWorkdayData,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CalendarDayRecord> {
    return tx.calendarDay.update({
      data: {
        workday: {
          update: {
            holidayName: workday.holidayName,
            isHoliday: workday.isHoliday,
            isPreholiday: workday.isPreholiday,
            isWorkingDay: workday.isWorkingDay,
            source: workday.source,
            workingHours: workday.workingHours,
          },
        },
      },
      select: calendarDaySelect,
      where: { date },
    });
  }

  async validateIntegrity(): Promise<CalendarIntegrityRepositoryReport> {
    const [summary] = await this.prisma.$queryRaw<
      CalendarIntegritySummaryRow[]
    >`
      SELECT
        (SELECT COUNT(*) FROM calendar_days)::bigint AS "totalDays",
        (SELECT COUNT(*) FROM calendar_workdays)::bigint AS "totalWorkdays",
        (
          SELECT COUNT(*)::bigint
          FROM (
            SELECT date
            FROM calendar_days
            GROUP BY date
            HAVING COUNT(*) > 1
          ) duplicates
        ) AS "dateDuplicates",
        (
          SELECT COUNT(*)::bigint
          FROM calendar_days
          LEFT JOIN calendar_workdays
            ON calendar_workdays.calendar_day_id = calendar_days.id
          WHERE calendar_workdays.calendar_day_id IS NULL
        ) AS "missingWorkdays",
        (
          SELECT COUNT(*)::bigint
          FROM calendar_workdays
          LEFT JOIN calendar_days
            ON calendar_days.id = calendar_workdays.calendar_day_id
          WHERE calendar_days.id IS NULL
        ) AS "orphanWorkdays"
    `;

    const holes = await this.prisma.$queryRaw<CalendarHoleRow[]>`
      SELECT expected_day::date AS date
      FROM generate_series(
        ${CALENDAR_START_DATE}::date,
        ${CALENDAR_END_DATE}::date,
        INTERVAL '1 day'
      ) AS expected(expected_day)
      LEFT JOIN calendar_days
        ON calendar_days.date = expected.expected_day::date
      WHERE calendar_days.id IS NULL
      ORDER BY expected_day
      LIMIT ${CALENDAR_MAX_HOLES}
    `;

    const dateDuplicates = this.toNumber(summary?.dateDuplicates);
    const foundHoles = holes.map((hole) => hole.date);
    const missingWorkdays = this.toNumber(summary?.missingWorkdays);
    const orphanWorkdays = this.toNumber(summary?.orphanWorkdays);
    const totalDays = this.toNumber(summary?.totalDays);
    const totalWorkdays = this.toNumber(summary?.totalWorkdays);
    const isValid =
      dateDuplicates === 0 &&
      foundHoles.length === 0 &&
      missingWorkdays === 0 &&
      orphanWorkdays === 0 &&
      totalDays === CALENDAR_EXPECTED_DAYS &&
      totalWorkdays === CALENDAR_EXPECTED_DAYS;

    return {
      dateDuplicates,
      expectedDays: CALENDAR_EXPECTED_DAYS,
      holes: foundHoles,
      isValid,
      missingWorkdays,
      orphanWorkdays,
      totalDays,
      totalWorkdays,
    };
  }

  private toNumber(value: bigint | undefined): number {
    return Number(value ?? 0);
  }
}
