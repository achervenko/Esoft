import {
  createProvider,
  eventResponse,
} from './equipment-events.provider.spec-fixtures';

describe('EquipmentEventsProvider extension validation', () => {
  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['array', []],
    ['primitive', 'equipment'],
    ['empty object', {}],
    ['wrong code', { ...eventResponse().extension, code: 'OTHER' }],
    [
      'missing maintenance type',
      { ...eventResponse().extension, maintenanceType: undefined },
    ],
    [
      'null maintenance type',
      { ...eventResponse().extension, maintenanceType: null },
    ],
    [
      'missing maintenance name',
      { ...eventResponse().extension, maintenanceType: {} },
    ],
    [
      'invalid maintenance name',
      { ...eventResponse().extension, maintenanceType: { name: 1 } },
    ],
    [
      'missing equipment',
      { ...eventResponse().extension, equipment: undefined },
    ],
    ['null equipment', { ...eventResponse().extension, equipment: null }],
    ['incomplete equipment', { ...eventResponse().extension, equipment: {} }],
    ...['name', 'visibleId', 'location', 'serialNumber'].map(
      (field): [string, unknown] => [
        'missing equipment ' + field,
        {
          ...eventResponse().extension,
          equipment: {
            ...eventResponse().extension.equipment,
            [field]: undefined,
          },
        },
      ],
    ),
    ...[0, -1, NaN, Infinity, 1.5, '1001'].map(
      (visibleId): [string, unknown] => [
        'invalid visibleId ' + String(visibleId),
        {
          ...eventResponse().extension,
          equipment: { ...eventResponse().extension.equipment, visibleId },
        },
      ],
    ),
  ])('rejects invalid equipment extension: %s', async (_label, extension) => {
    const { eventsQueryService, provider } = createProvider();
    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({ extension }),
    ]);
    await expect(
      provider.getCalendarData({
        dateFrom: new Date('2026-08-01T00:00:00.000Z'),
        dateTo: new Date('2026-08-31T00:00:00.000Z'),
        today: new Date('2026-08-04T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      response: { code: 'CALENDAR_EVENT_EXTENSION_INVALID' },
    });
  });

  it('accepts empty location and nullable serial number and preserves extension details', async () => {
    const { eventsQueryService, provider } = createProvider();
    const extension = {
      ...eventResponse().extension,
      equipment: {
        ...eventResponse().extension.equipment,
        location: '',
        serialNumber: null,
      },
    };
    eventsQueryService.findAll.mockResolvedValue([
      eventResponse({ extension }),
    ]);
    const calendar = await provider.getCalendarData({
      dateFrom: new Date('2026-08-01'),
      dateTo: new Date('2026-08-31'),
      today: new Date('2026-08-04'),
    });
    expect(calendar.layers![0].items[0]).toMatchObject({
      badge: 'ТО-1',
      subtitle: '',
      navigation: { params: { equipmentVisibleId: 1001 } },
    });
    expect(calendar.layers![0].items[0].details).toBe(extension);
  });
});
