import { CalendarSource } from '@prisma/client';
import { ProductionCalendarProvider } from './production-calendar.provider';
import { CalendarDayType } from './calendar-engine.types';

describe('ProductionCalendarProvider', () => {
  it('maps production calendar days to engine day dto', async () => {
    const calendarService = {
      getRange: jest.fn().mockResolvedValue({
        days: [
          calendarDay({ date: '2026-08-03', isWorkingDay: true }),
          calendarDay({
            date: '2026-08-04',
            isHoliday: true,
            holidayName: 'Праздник',
            source: CalendarSource.MANUAL,
          }),
          calendarDay({ date: '2026-08-05', isPreholiday: true }),
          calendarDay({ date: '2026-08-06', isWorkingDay: false }),
        ],
      }),
    };
    const provider = new ProductionCalendarProvider(calendarService as never);
    const period = {
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-06T00:00:00.000Z'),
      today: new Date('2026-08-01T00:00:00.000Z'),
    };

    await expect(provider.getCalendarData(period)).resolves.toEqual({
      days: [
        {
          comment: null,
          date: '2026-08-03',
          isManual: false,
          type: CalendarDayType.WORKING,
        },
        {
          comment: 'Праздник',
          date: '2026-08-04',
          isManual: true,
          type: CalendarDayType.HOLIDAY,
        },
        {
          comment: null,
          date: '2026-08-05',
          isManual: false,
          type: CalendarDayType.SHORTENED,
        },
        {
          comment: null,
          date: '2026-08-06',
          isManual: false,
          type: CalendarDayType.WEEKEND,
        },
      ],
    });

    expect(calendarService.getRange).toHaveBeenCalledWith(
      period.dateFrom,
      period.dateTo,
    );
  });
});

function calendarDay(overrides = {}) {
  return {
    date: '2026-08-03',
    day: 3,
    dayOfWeek: 1,
    dayOfYear: 215,
    holidayName: null,
    isHoliday: false,
    isPreholiday: false,
    isWorkingDay: false,
    isoWeekYear: 2026,
    month: 8,
    quarter: 3,
    source: CalendarSource.SYSTEM,
    week: 32,
    workingHours: 8,
    year: 2026,
    ...overrides,
  };
}
