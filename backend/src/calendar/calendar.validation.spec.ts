import {
  parseCalendarRangeQuery,
  parseCalendarWorkdayUpdateDto,
} from './calendar.validation';
import {
  CALENDAR_END_DATE,
  CALENDAR_START_DATE,
  CALENDAR_START,
} from './calendar.constants';
import { formatCalendarDate } from './calendar.date';

type ExceptionResponse = {
  code: string;
  message: string;
};

type ExceptionWithResponse = {
  getResponse(): ExceptionResponse;
};

describe('calendar validation', () => {
  it('parses valid calendar range', () => {
    expect(
      parseCalendarRangeQuery({
        dateFrom: '2026-12-31',
        dateTo: '2027-01-01',
      }),
    ).toEqual({
      dateFrom: new Date('2026-12-31T00:00:00.000Z'),
      dateTo: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('rejects dates outside calendar bounds', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarRangeQuery({
          dateFrom: formatCalendarDate(addUtcDays(CALENDAR_START, -1)),
          dateTo: CALENDAR_START_DATE,
        }),
      ),
    ).toEqual({
      code: 'DATE_OUT_OF_RANGE',
      message: `Дата должна быть в диапазоне ${CALENDAR_START_DATE} - ${CALENDAR_END_DATE}.`,
    });
  });

  it('rejects reversed calendar range', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarRangeQuery({
          dateFrom: '2027-01-01',
          dateTo: '2026-12-31',
        }),
      ),
    ).toEqual({
      code: 'DATE_RANGE_INVALID',
      message: 'Дата начала периода не может быть позже даты окончания.',
    });
  });

  it.each(['2026/08/01', '01.08.2026'])(
    'rejects invalid date format %s',
    (date) => {
      expect(
        getThrownResponse(() =>
          parseCalendarRangeQuery({
            dateFrom: date,
            dateTo: '2026-08-02',
          }),
        ),
      ).toEqual({
        code: 'DATE_INVALID',
        message: 'Некорректная дата.',
      });
    },
  );

  it('rejects invalid calendar date', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarRangeQuery({
          dateFrom: '2026-02-30',
          dateTo: '2026-03-01',
        }),
      ),
    ).toEqual({
      code: 'DATE_INVALID',
      message: 'Некорректная дата.',
    });
  });

  it('rejects working day with zero working hours', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarWorkdayUpdateDto({
          date: '2026-08-03',
          isWorkingDay: true,
          workingHours: 0,
        }),
      ),
    ).toEqual({
      code: 'WORKING_HOURS_INVALID',
      message: 'Для рабочего дня укажите положительную продолжительность.',
    });
  });

  it('accepts custom working hours for working day', () => {
    expect(
      parseCalendarWorkdayUpdateDto({
        date: '2026-08-03',
        isWorkingDay: true,
        workingHours: 6,
      }),
    ).toEqual({
      date: new Date('2026-08-03T00:00:00.000Z'),
      isWorkingDay: true,
      workingHours: 6,
    });
  });

  it('rejects workday update without changed fields', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarWorkdayUpdateDto({
          date: '2026-08-03',
        }),
      ),
    ).toEqual({
      code: 'WORKDAY_CHANGE_REQUIRED',
      message: 'Укажите изменения производственного календаря.',
    });
  });

  it('trims holiday name', () => {
    expect(
      parseCalendarWorkdayUpdateDto({
        date: '2026-01-01',
        holidayName: ' Новый год ',
      }),
    ).toEqual({
      date: new Date('2026-01-01T00:00:00.000Z'),
      holidayName: 'Новый год',
    });
  });

  it('rejects non-working day with positive explicit working hours', () => {
    expect(
      getThrownResponse(() =>
        parseCalendarWorkdayUpdateDto({
          date: '2026-08-01',
          isWorkingDay: false,
          workingHours: 8,
        }),
      ),
    ).toEqual({
      code: 'WORKING_HOURS_INVALID',
      message: 'Для нерабочего дня продолжительность должна быть 0.',
    });
  });

  it('normalizes blank holiday name to null', () => {
    expect(
      parseCalendarWorkdayUpdateDto({
        date: '2026-08-01',
        holidayName: '   ',
      }),
    ).toEqual({
      date: new Date('2026-08-01T00:00:00.000Z'),
      holidayName: null,
    });
  });
});

function getThrownResponse(action: () => unknown): ExceptionResponse {
  try {
    action();
  } catch (error) {
    return (error as ExceptionWithResponse).getResponse();
  }

  throw new Error('Expected action to throw.');
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
}
