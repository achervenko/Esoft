import { NotFoundException } from '@nestjs/common';
import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import type { EventsListRecordsQuery } from '../events/events-query.service';
import { EquipmentEventsQueryService } from './equipment-events-query.service';

describe('EquipmentEventsQueryService', () => {
  const defaultQuery = {
    limit: 20,
    offset: 0,
  };

  function createService() {
    const eventsQueryService = {
      findDetailRecord: jest.fn(),
      findListRecords: jest.fn(),
      findResponsibleUsers: jest.fn().mockResolvedValue({
        users: [],
      }),
    };

    return {
      eventsQueryService,
      service: new EquipmentEventsQueryService(eventsQueryService as never),
    };
  }

  it('filters list by equipment extension scope', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findListRecords.mockResolvedValue({
      checklistsByEventId: new Map(),
      events: [],
    });

    await service.findAll(defaultQuery);

    const [listQuery] = eventsQueryService.findListRecords.mock.calls[0] as [
      EventsListRecordsQuery,
    ];

    expect(listQuery.where).toMatchObject({
      extensionCode: EventExtensionCode.EQUIPMENT,
      equipmentExtension: {
        is: {},
      },
    });
  });

  it('passes pagination and default ordering to generic list query', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findListRecords.mockResolvedValue({
      checklistsByEventId: new Map(),
      events: [],
    });

    await service.findAll({
      ...defaultQuery,
      limit: 25,
      offset: 50,
    });

    const [listQuery] = eventsQueryService.findListRecords.mock.calls[0] as [
      EventsListRecordsQuery,
    ];

    expect(listQuery.limit).toBe(25);
    expect(listQuery.offset).toBe(50);
    expect(listQuery.orderBy).toEqual([
      { factDate: { sort: 'desc', nulls: 'last' } },
      { plannedDate: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('applies equipment-specific filters through extension relation', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findListRecords.mockResolvedValue({
      checklistsByEventId: new Map(),
      events: [],
    });

    await service.findAll({
      ...defaultQuery,
      equipmentVisibleId: 123,
      maintenanceTypeId: 456,
    });

    const [listQuery] = eventsQueryService.findListRecords.mock.calls[0] as [
      EventsListRecordsQuery,
    ];

    expect(listQuery.where).toMatchObject({
      equipmentExtension: {
        is: {
          equipment: { visibleId: 123 },
          eventTypeId: 456,
        },
      },
    });
  });

  it('filters date range by planned date', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findListRecords.mockResolvedValue({
      checklistsByEventId: new Map(),
      events: [],
    });
    const dateFrom = new Date('2026-08-01T00:00:00.000Z');
    const dateTo = new Date('2026-08-31T00:00:00.000Z');

    await service.findAll({
      ...defaultQuery,
      dateFrom,
      dateTo,
    });

    const [listQuery] = eventsQueryService.findListRecords.mock.calls[0] as [
      EventsListRecordsQuery,
    ];

    expect(listQuery.where).toMatchObject({
      plannedDate: {
        gte: dateFrom,
        lte: dateTo,
      },
    });
    expect(listQuery.where).not.toHaveProperty('factDate');
  });

  it('does not present standalone event returned by generic list', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findListRecords.mockResolvedValue({
      checklistsByEventId: new Map(),
      events: [
        {
          equipmentExtension: null,
          extensionCode: null,
          factDate: null,
          id: 1,
          note: null,
          plannedDate: new Date('2026-08-01T00:00:00.000Z'),
          responsibles: [],
          source: EventSource.MANUAL,
          status: EventStatus.CREATED,
          title: 'Standalone',
          version: 1,
        },
      ],
    });

    await expect(service.findAll(defaultQuery)).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });
  });

  it('loads detail only inside equipment extension scope', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findDetailRecord.mockResolvedValue(null);

    await expect(service.findOne(10)).rejects.toBeInstanceOf(NotFoundException);

    expect(eventsQueryService.findDetailRecord).toHaveBeenCalledWith({
      id: 10,
      extensionCode: EventExtensionCode.EQUIPMENT,
      equipmentExtension: {
        is: {},
      },
    });
  });

  it('returns EVENT_NOT_FOUND for standalone detail id', async () => {
    const { eventsQueryService, service } = createService();
    eventsQueryService.findDetailRecord.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });
  });

  it('delegates responsible users to generic query service', async () => {
    const { eventsQueryService, service } = createService();

    await expect(service.findResponsibleUsers()).resolves.toEqual({
      users: [],
    });

    expect(eventsQueryService.findResponsibleUsers).toHaveBeenCalledTimes(1);
  });
});
