import { CalendarSource, Prisma } from '@prisma/client';
import type {
  CalendarDayRecord,
  CalendarDayRecordWithWorkday,
} from './calendar.select';

export type MockCalendarRepository = {
  findDay: jest.Mock;
  findRange: jest.Mock;
  transaction: jest.Mock;
  updateWorkday: jest.Mock;
  validateIntegrity: jest.Mock;
};

export function createMockCalendarRepository(): MockCalendarRepository {
  const tx = {} as Prisma.TransactionClient;

  return {
    findDay: jest.fn(),
    findRange: jest.fn(),
    transaction: jest.fn(
      async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      ): Promise<unknown> => callback(tx),
    ),
    updateWorkday: jest.fn(),
    validateIntegrity: jest.fn(),
  };
}

export function calendarRecord(
  date: string,
  overrides: {
    dayOfWeek?: number;
    isWorkingDay?: boolean;
    source?: CalendarSource;
    workingHours?: number;
  } = {},
): CalendarDayRecordWithWorkday {
  // Calendar metadata values are not relevant for these service tests.
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    day: Number(date.slice(8, 10)),
    dayOfWeek: overrides.dayOfWeek ?? 1,
    dayOfYear: 215,
    isoWeekYear: 2026,
    month: Number(date.slice(5, 7)),
    quarter: 3,
    week: 32,
    workday: {
      holidayName: null,
      isHoliday: false,
      isPreholiday: false,
      isWorkingDay: overrides.isWorkingDay ?? true,
      source: overrides.source ?? CalendarSource.SYSTEM,
      workingHours: new Prisma.Decimal(overrides.workingHours ?? 8),
    },
    year: Number(date.slice(0, 4)),
  };
}

export function calendarRecordWithoutWorkday(date: string): CalendarDayRecord {
  return {
    ...calendarRecord(date),
    workday: null,
  };
}
