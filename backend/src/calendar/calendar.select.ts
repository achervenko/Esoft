import { Prisma } from '@prisma/client';

export const calendarDaySelect = {
  date: true,
  day: true,
  dayOfWeek: true,
  dayOfYear: true,
  isoWeekYear: true,
  month: true,
  quarter: true,
  week: true,
  workday: {
    select: {
      holidayName: true,
      isHoliday: true,
      isPreholiday: true,
      isWorkingDay: true,
      source: true,
      workingHours: true,
    },
  },
  year: true,
} satisfies Prisma.CalendarDaySelect;

export type CalendarDayRecord = Prisma.CalendarDayGetPayload<{
  select: typeof calendarDaySelect;
}>;

export type CalendarDayRecordWithWorkday = CalendarDayRecord & {
  workday: NonNullable<CalendarDayRecord['workday']>;
};
