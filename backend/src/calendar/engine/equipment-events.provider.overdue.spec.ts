import { EventStatus } from '@prisma/client';
import {
  createProvider,
  eventResponse,
} from './equipment-events.provider.spec-fixtures';

describe('EquipmentEventsProvider overdue', () => {
  it.each([
    [EventStatus.CREATED, true, 3],
    [EventStatus.IN_PROGRESS, true, 3],
    [EventStatus.CANCELLED, false, 0],
    [EventStatus.COMPLETED, false, 0],
  ])(
    'marks overdue only open events: %s',
    async (status, isOverdue, overdueDays) => {
      const { eventsQueryService, provider } = createProvider();
      eventsQueryService.findAll.mockResolvedValue([eventResponse({ status })]);
      const calendar = await provider.getCalendarData({
        dateFrom: new Date('2026-08-01'),
        dateTo: new Date('2026-08-31'),
        today: new Date('2026-08-04'),
      });
      expect(calendar.layers![0].items[0]).toMatchObject({
        status,
        isOverdue,
        overdueDays,
        displayDate: '2026-08-01',
      });
    },
  );
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
});
