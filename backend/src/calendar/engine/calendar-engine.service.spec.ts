import { CalendarEngineService } from './calendar-engine.service';
import {
  CalendarDayType,
  type CalendarPeriod,
  type CalendarProvider,
} from './calendar-engine.types';

describe('CalendarEngineService', () => {
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
    let receivedPeriod: CalendarPeriod | null = null;
    const getCalendarData: CalendarProvider['getCalendarData'] = jest
      .fn()
      .mockImplementation((period: CalendarPeriod) => {
        receivedPeriod = period;

        return Promise.resolve({});
      });

    await service.buildCalendar({
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-05T00:00:00.000Z'),
      providers: [{ getCalendarData }],
    });

    expect(receivedPeriod).toMatchObject({
      dateFrom: new Date('2026-08-03T00:00:00.000Z'),
      dateTo: new Date('2026-08-05T00:00:00.000Z'),
    });
    expect(receivedPeriod?.today).toBeInstanceOf(Date);
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
