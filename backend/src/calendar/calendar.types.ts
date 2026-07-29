import type { CalendarSource } from '@prisma/client';

export type CalendarDayResponse = {
  date: string;
  day: number;
  dayOfWeek: number;
  dayOfYear: number;
  isHoliday: boolean;
  isPreholiday: boolean;
  isWorkingDay: boolean;
  isoWeekYear: number;
  holidayName: string | null;
  month: number;
  quarter: number;
  source: CalendarSource;
  week: number;
  workingHours: number;
  year: number;
};

export type CalendarRangeResponse = {
  days: CalendarDayResponse[];
};

export type CalendarIntegrityReport = {
  dateDuplicates: number;
  expectedDays: number;
  holes: string[];
  isValid: boolean;
  missingWorkdays: number;
  orphanWorkdays: number;
  totalDays: number;
  totalWorkdays: number;
};

export type CalendarIntegrityRepositoryReport = {
  dateDuplicates: number;
  expectedDays: number;
  holes: Date[];
  isValid: boolean;
  missingWorkdays: number;
  orphanWorkdays: number;
  totalDays: number;
  totalWorkdays: number;
};

export type CalendarWorkdayUpdate = {
  date: Date;
  holidayName?: string | null;
  isHoliday?: boolean;
  isPreholiday?: boolean;
  isWorkingDay?: boolean;
  source?: CalendarSource;
  workingHours?: number;
};

export type CalendarWorkdayData = {
  holidayName: string | null;
  isHoliday: boolean;
  isPreholiday: boolean;
  isWorkingDay: boolean;
  source: CalendarSource;
  workingHours: number;
};
