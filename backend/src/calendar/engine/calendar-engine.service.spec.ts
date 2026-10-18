import { CalendarEngineService } from './calendar-engine.service';
import {
  CalendarDayType,
  type CalendarPeriod,
  type CalendarProvider,
} from './calendar-engine.types';

describe('CalendarEngineService', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    ['2026-10-06T20:59:59Z', '2026-10-06'],
    ['2026-10-06T21:00:00Z', '2026-10-07'],
    ['2026-12-31T21:00:00Z', '2027-01-01'],
  ])('uses the Moscow business date at %s', async (now, expected) => {
    jest.useFakeTimers().setSystemTime(new Date(now));
    const getCalendarData = jest.fn().mockResolvedValue({});
    await new CalendarEngineService().buildCalendar({
      dateFrom: new Date('2026-10-01'),
      dateTo: new Date('2026-10-31'),
      providers: [{ getCalendarData }],
    });
    expect(getCalendarData).toHaveBeenCalledWith(
      expect.objectContaining({ today: new Date(`${expected}T00:00:00Z`) }),
    );
  });
  it('returns empty calendar when no providers are resolved', async () => {
    const service = new CalendarEngineService();

    await expect(
      service.buildCalendar({
        dateFrom: new Date('2026-08-03T00:00:00.000Z'),
        dateTo: new Date('2026-08-03T00:00:00.000Z'),
        providers: [],
      }),
    ).resolves.toEqual({
      days: [],
      layers: [],
    });
  });

  it('ignores provider without days and layers', async () => {
    const service = new CalendarEngineService();

    await expect(
      service.buildCalendar({
        dateFrom: new Date('2026-08-03T00:00:00.000Z'),
        dateTo: new Date('2026-08-03T00:00:00.000Z'),
        providers: [provider({})],
      }),
    ).resolves.toEqual({
      days: [],
      layers: [],
    });
  });

  it('passes calendar period to providers', async () => {
    const service = new CalendarEngineService();
    const receivedPeriods: CalendarPeriod[] = [];
    const getCalendarData: CalendarProvider['getCalendarData'] = jest
      .fn()
      .mockImplementation((period: CalendarPeriod) => {
        receivedPeriods.push(period);

        return Promise.resolve({});
      });

    await service.buildCalendar({
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-05T00:00:00.000Z'),
      providers: [{ getCalendarData }],
    });

    expect(receivedPeriods[0]).toMatchObject({
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-05T00:00:00.000Z'),
    });
    expect(receivedPeriods[0].today).toBeInstanceOf(Date);
  });

  it('combines provider data into calendar dto', async () => {
    const service = new CalendarEngineService();
    const productionProvider = provider({
      days: [
        {
          comment: null,
          date: '2026-08-03',
          isManual: false,
          type: CalendarDayType.WORKING,
        },
      ],
    });
    const eventsProvider = provider({
      layers: [
        {
          code: 'EVENTS',
          items: [
            {
              displayDate: '2026-08-03',
              id: '1',
              source: 'EQUIPMENT',
              title: 'ТО',
            },
          ],
          title: 'События',
        },
      ],
    });

    await expect(
      service.buildCalendar({
        dateFrom: new Date('2026-08-03T00:00:00.000Z'),
        dateTo: new Date('2026-08-03T00:00:00.000Z'),
        providers: [productionProvider, eventsProvider],
      }),
    ).resolves.toEqual({
      days: [
        {
          comment: null,
          date: '2026-08-03',
          isManual: false,
          type: CalendarDayType.WORKING,
        },
      ],
      layers: [
        {
          code: 'EVENTS',
          items: [
            {
              displayDate: '2026-08-03',
              id: '1',
              source: 'EQUIPMENT',
              title: 'ТО',
            },
          ],
          title: 'События',
        },
      ],
    });
  });

  it('rejects duplicate layer codes', async () => {
    const service = new CalendarEngineService();
    const firstProvider = provider({
      layers: [{ code: 'EVENTS', items: [], title: 'События' }],
    });
    const secondProvider = provider({
      layers: [{ code: 'EVENTS', items: [], title: 'Events' }],
    });

    await expect(
      service.buildCalendar({
        dateFrom: new Date('2026-08-03T00:00:00.000Z'),
        dateTo: new Date('2026-08-03T00:00:00.000Z'),
        providers: [firstProvider, secondProvider],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_LAYER_DUPLICATE',
        message: 'Календарный слой с таким кодом уже сформирован.',
      },
    });
  });
});

function provider(
  data: Awaited<ReturnType<CalendarProvider['getCalendarData']>>,
): CalendarProvider {
  return {
    getCalendarData: jest.fn().mockResolvedValue(data),
  };
}
