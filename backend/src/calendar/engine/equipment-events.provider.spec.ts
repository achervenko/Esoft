import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import { EquipmentEventsProvider } from './equipment-events.provider';
import { CalendarItemSource, CalendarLayerCode } from './calendar-engine.types';

describe('EquipmentEventsProvider', () => {
  function createProvider() {
    const eventsQueryService = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    const provider = new EquipmentEventsProvider(eventsQueryService as never);

    return { eventsQueryService, provider };
  }

  it('loads events filtered by display date inside requested period', async () => {
    const { eventsQueryService, provider } = createProvider();
    const dateFrom = new Date('2026-08-01T00:00:00.000Z');
    const dateTo = new Date('2026-08-31T00:00:00.000Z');

    await provider.getCalendarData({
      dateFrom,
      dateTo,
      today: new Date('2026-08-10T00:00:00.000Z'),
    });

    expect(eventsQueryService.findAll).toHaveBeenCalledWith({
      orderBy: [
        { factDate: { sort: 'asc', nulls: 'last' } },
        { plannedDate: 'asc' },
        { id: 'asc' },
      ],
      where: {
        extensionCode: EventExtensionCode.EQUIPMENT,
        OR: [
          {
            factDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          {
            factDate: null,
            plannedDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
        ],
      },
    });
  });

  it('returns normalized layer items with display date and overdue state', async () => {
    const { eventsQueryService, provider } = createProvider();

    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({
        id: 2,
        plannedDate: '2026-08-01',
        title: 'Просроченное ТО',
      }),
      eventResponse({
        factDate: '2026-08-03',
        id: 1,
        plannedDate: '2026-08-01',
        status: EventStatus.COMPLETED,
        title: 'Выполненное ТО',
      }),
    ]);

    await expect(
      provider.getCalendarData({
        dateFrom: new Date('2026-08-01T00:00:00.000Z'),
        dateTo: new Date('2026-08-31T00:00:00.000Z'),
        today: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      layers: [
        {
          code: CalendarLayerCode.EVENTS,
          items: [
            expect.objectContaining({
              displayDate: '2026-08-01',
              id: '2',
              isOverdue: true,
              overdueDays: 3,
              plannedDate: '2026-08-01',
              source: CalendarItemSource.EQUIPMENT,
              title: 'Просроченное ТО',
            }),
            expect.objectContaining({
              displayDate: '2026-08-03',
              factDate: '2026-08-03',
              id: '1',
              isOverdue: false,
              overdueDays: 0,
              plannedDate: '2026-08-01',
              source: CalendarItemSource.EQUIPMENT,
              title: 'Выполненное ТО',
            }),
          ],
          title: 'События',
        },
      ],
    });
  });

  it('does not mark event overdue when planned date is today', async () => {
    const { eventsQueryService, provider } = createProvider();

    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({
        plannedDate: '2026-08-04',
      }),
    ]);

    await expect(
      provider.getCalendarData({
        dateFrom: new Date('2026-08-01T00:00:00.000Z'),
        dateTo: new Date('2026-08-31T00:00:00.000Z'),
        today: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      layers: [
        {
          items: [
            {
              displayDate: '2026-08-04',
              isOverdue: false,
              overdueDays: 0,
            },
          ],
        },
      ],
    });
  });

  it('rejects event without display date', async () => {
    const { eventsQueryService, provider } = createProvider();

    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({
        factDate: null,
        plannedDate: null,
      }),
    ]);

    await expect(
      provider.getCalendarData({
        dateFrom: new Date('2026-08-01T00:00:00.000Z'),
        dateTo: new Date('2026-08-31T00:00:00.000Z'),
        today: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_EVENT_DATE_MISSING',
        message: 'Событие не содержит дату отображения.',
      },
    });
  });

  it('uses fact date as display date when planned date is missing', async () => {
    const { eventsQueryService, provider } = createProvider();

    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({
        factDate: '2026-08-03',
        plannedDate: null,
      }),
    ]);

    await expect(
      provider.getCalendarData({
        dateFrom: new Date('2026-08-01T00:00:00.000Z'),
        dateTo: new Date('2026-08-31T00:00:00.000Z'),
        today: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      layers: [
        {
          items: [
            {
              displayDate: '2026-08-03',
              factDate: '2026-08-03',
              isOverdue: false,
              overdueDays: 0,
              plannedDate: null,
            },
          ],
        },
      ],
    });
  });
});

function eventResponse(overrides = {}) {
  return {
    checklists: [],
    extension: {
      code: EventExtensionCode.EQUIPMENT,
      equipment: {
        visibleId: 1001,
      },
    },
    extensionCode: EventExtensionCode.EQUIPMENT,
    factDate: null,
    id: 1,
    note: null,
    plannedDate: '2026-08-01',
    responsibles: [],
    source: EventSource.MANUAL,
    status: EventStatus.CREATED,
    title: 'ТО',
    version: 1,
    ...overrides,
  };
}
