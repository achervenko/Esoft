import { EventSource } from '@prisma/client';
import type {
  CreateEventActor,
  CreateEventCommand,
  EventCreateOptions,
} from './events-create.types';
import { EventsService } from './events.service';

describe('EventsService', () => {
  function createService() {
    const checklistCreator = {
      createEventChecklists: jest.fn(),
    };
    const detailResponse = { id: 1, title: 'Updated event' };
    const createEvent = jest
      .fn<
        Promise<number>,
        [CreateEventCommand, CreateEventActor, EventCreateOptions?]
      >()
      .mockResolvedValue(25);
    const eventsCreateService = {
      create: createEvent,
    };
    const queryService = {
      findAll: jest.fn().mockResolvedValue([detailResponse]),
      findOne: jest.fn().mockResolvedValue(detailResponse),
    };
    const lifecycleService = {
      cancel: jest.fn().mockResolvedValue({ eventId: 1 }),
      complete: jest.fn().mockResolvedValue({ eventId: 1 }),
      start: jest.fn().mockResolvedValue({ eventId: 1 }),
    };
    const updateService = {
      updateCreated: jest.fn().mockResolvedValue({
        eventId: 1,
        updated: true,
      }),
    };
    const service = new EventsService(
      checklistCreator as never,
      eventsCreateService as never,
      lifecycleService as never,
      queryService as never,
      updateService as never,
    );

    return {
      checklistCreator,
      detailResponse,
      eventsCreateService,
      lifecycleService,
      queryService,
      service,
      updateService,
    };
  }

  it('creates generic event and returns detail response', async () => {
    const { detailResponse, eventsCreateService, queryService, service } =
      createService();
    const command: CreateEventCommand = {
      checklistAssignments: [],
      extensionCode: null,
      note: null,
      originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibleUserIds: ['user-1'],
      source: EventSource.MANUAL,
      title: 'Standalone event',
    };

    await expect(service.create(command, 'user-1')).resolves.toBe(
      detailResponse,
    );

    const [createdCommand, actor, options] =
      eventsCreateService.create.mock.calls[0];

    expect(eventsCreateService.create).toHaveBeenCalledTimes(1);
    expect(createdCommand).toBe(command);
    expect(actor).toEqual({
      kind: 'user',
      userId: 'user-1',
    });
    expect(options?.createChecklists).toBeInstanceOf(Function);
    expect(options?.createExtension).toBeUndefined();
    expect(queryService.findOne).toHaveBeenCalledWith(25);
  });

  it('passes generic checklist creator to create service', async () => {
    const { checklistCreator, eventsCreateService, service } = createService();
    const tx = {};
    const assignments = [
      {
        assignedUserId: 'user-1',
        checklistTemplateId: 11,
      },
    ];

    await service.create(
      {
        checklistAssignments: assignments,
        extensionCode: null,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibleUserIds: ['user-1'],
        source: EventSource.MANUAL,
        title: 'Standalone event',
      },
      'user-1',
    );

    const options = eventsCreateService.create.mock.calls[0]?.[2];

    await options?.createChecklists?.({
      assignments,
      createdBy: 'user-1',
      eventId: 25,
      tx: tx as never,
    });

    expect(checklistCreator.createEventChecklists).toHaveBeenCalledWith(tx, {
      assignments,
      createdBy: 'user-1',
      eventId: 25,
    });
  });

  it('delegates findOne to query service', async () => {
    const { detailResponse, queryService, service } = createService();

    await expect(service.findOne(1)).resolves.toBe(detailResponse);

    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  it('delegates findAll to query service', async () => {
    const { detailResponse, queryService, service } = createService();
    const query = {
      limit: 50,
      offset: 0,
      where: {
        extensionCode: null,
      },
    };

    await expect(service.findAll(query)).resolves.toEqual([detailResponse]);

    expect(queryService.findAll).toHaveBeenCalledWith(query);
  });

  it('updates generic event and returns detail response', async () => {
    const {
      checklistCreator,
      detailResponse,
      queryService,
      service,
      updateService,
    } = createService();

    await expect(
      service.updateCreated(
        1,
        {
          title: 'Updated event',
          version: 2,
        },
        'user-1',
      ),
    ).resolves.toBe(detailResponse);

    expect(updateService.updateCreated).toHaveBeenCalledWith(
      checklistCreator,
      1,
      {
        title: 'Updated event',
        version: 2,
      },
      'user-1',
    );
    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  it('returns detail response after no-op update result', async () => {
    const { detailResponse, queryService, service, updateService } =
      createService();
    updateService.updateCreated.mockResolvedValue({
      eventId: 1,
      updated: false,
    });

    await expect(
      service.updateCreated(
        1,
        {
          title: 'Same title',
          version: 2,
        },
        'user-1',
      ),
    ).resolves.toBe(detailResponse);

    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  it.each([
    {
      data: { version: 1 },
      methodName: 'start',
    },
    {
      data: {
        factDate: new Date('2026-08-01T00:00:00.000Z'),
        version: 1,
      },
      methodName: 'complete',
    },
    {
      data: { version: 1 },
      methodName: 'cancel',
    },
  ] as const)(
    'delegates $methodName lifecycle operation and returns detail response',
    async ({ data, methodName }) => {
      const { detailResponse, lifecycleService, queryService, service } =
        createService();

      await expect(service[methodName](1, data, 'user-1')).resolves.toBe(
        detailResponse,
      );

      expect(lifecycleService[methodName]).toHaveBeenCalledWith(
        1,
        data,
        'user-1',
      );
      expect(queryService.findOne).toHaveBeenCalledWith(1);
    },
  );
});
