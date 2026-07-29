jest.mock(
  '../equipment-event-extension/equipment-event-extension.audit',
  () => ({
    getEquipmentEventExtensionAuditSnapshot: jest.fn(),
    writeEquipmentEventExtensionCreatedAudit: jest.fn(),
    writeEquipmentEventExtensionUpdatedAudit: jest.fn(),
  }),
);

import { EventExtensionCode, EventSource } from '@prisma/client';
import {
  getEquipmentEventExtensionAuditSnapshot,
  writeEquipmentEventExtensionCreatedAudit,
  writeEquipmentEventExtensionUpdatedAudit,
} from '../equipment-event-extension/equipment-event-extension.audit';
import type {
  CreateEventActor,
  CreateEventCommand,
  EventCreateOptions,
} from './events-create.types';
import type { EventsUpdateService } from './events-update.service';
import { EventsService } from './events.service';

const getEquipmentEventAuditSnapshotMock =
  getEquipmentEventExtensionAuditSnapshot as jest.MockedFunction<
    typeof getEquipmentEventExtensionAuditSnapshot
  >;
const writeEquipmentEventCreatedAuditMock =
  writeEquipmentEventExtensionCreatedAudit as jest.MockedFunction<
    typeof writeEquipmentEventExtensionCreatedAudit
  >;
const writeEquipmentEventUpdatedAuditMock =
  writeEquipmentEventExtensionUpdatedAudit as jest.MockedFunction<
    typeof writeEquipmentEventExtensionUpdatedAudit
  >;

describe('EventsService', () => {
  function createService() {
    const checklistCreator = {
      createEventChecklists: jest.fn(),
    };
    const equipmentExtensionService = {
      assertChecklistTemplatesAllowed: jest.fn(),
      create: jest.fn(),
      prepareCreate: jest.fn().mockResolvedValue({
        equipmentId: 100,
        eventTypeId: 10,
        executionType: 'INTERNAL',
        maintenanceSettingId: 50,
      }),
      prepareUpdateCreated: jest.fn().mockResolvedValue({
        equipmentId: undefined,
        eventTypeId: undefined,
        finalMaintenanceSettingId: 50,
        maintenanceSetting: undefined,
      }),
      updateCreated: jest.fn(),
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
      findResponsibleUsers: jest.fn().mockResolvedValue({
        users: [],
      }),
    };
    const lifecycleService = {
      cancel: jest.fn().mockResolvedValue({ eventId: 1 }),
      complete: jest.fn().mockResolvedValue({ eventId: 1 }),
      start: jest.fn().mockResolvedValue({ eventId: 1 }),
    };
    const updateCreated: jest.MockedFunction<
      EventsUpdateService['updateCreated']
    > = jest.fn().mockResolvedValue({
      eventId: 1,
      updated: true,
    });
    const updateService = {
      updateCreated,
    };
    const service = new EventsService(
      checklistCreator as never,
      eventsCreateService as never,
      equipmentExtensionService as never,
      lifecycleService as never,
      queryService as never,
      updateService as never,
    );

    return {
      checklistCreator,
      detailResponse,
      equipmentExtensionService,
      eventsCreateService,
      lifecycleService,
      queryService,
      service,
      updateService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getEquipmentEventAuditSnapshotMock.mockResolvedValue({
      equipmentName: 'Pump',
      equipmentVisibleId: 1001,
      eventTypeCode: 'MAINTENANCE',
      eventTypeId: 10,
      eventTypeName: 'Maintenance',
      executionType: 'INTERNAL',
      id: 25,
      maintenanceSettingId: 50,
    });
  });

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

  it('creates equipment event through generic create callbacks', async () => {
    const {
      equipmentExtensionService,
      eventsCreateService,
      queryService,
      service,
    } = createService();
    const tx = {};

    await service.create(
      {
        checklistAssignments: [],
        extension: {
          equipmentVisibleId: 1001,
          maintenanceTypeId: 10,
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibleUserIds: ['user-1'],
        source: EventSource.MANUAL,
        title: 'Equipment event',
      },
      'user-1',
    );

    const [createdCommand, , options] =
      eventsCreateService.create.mock.calls[0];

    expect(createdCommand).toMatchObject({
      extensionCode: EventExtensionCode.EQUIPMENT,
      title: 'Equipment event',
    });
    expect(options?.createExtension).toBeDefined();
    await options?.createExtension?.({
      eventId: 25,
      tx: tx as never,
    });

    expect(equipmentExtensionService.prepareCreate).toHaveBeenCalledWith(tx, {
      equipmentVisibleId: 1001,
      maintenanceTypeId: 10,
    });
    expect(equipmentExtensionService.create).toHaveBeenCalledWith(
      tx,
      25,
      expect.objectContaining({
        maintenanceSettingId: 50,
      }),
    );
    await options?.afterCreate?.({
      eventId: 25,
      tx: tx as never,
    });
    expect(writeEquipmentEventCreatedAuditMock).toHaveBeenCalledWith(tx, {
      event: {
        equipmentName: 'Pump',
        equipmentVisibleId: 1001,
        eventTypeCode: 'MAINTENANCE',
        eventTypeId: 10,
        eventTypeName: 'Maintenance',
        executionType: 'INTERNAL',
        id: 25,
        maintenanceSettingId: 50,
      },
      userId: 'user-1',
    });
    expect(queryService.findOne).toHaveBeenCalledWith(25);
  });

  it('validates equipment checklist templates before generic checklist creation', async () => {
    const {
      checklistCreator,
      equipmentExtensionService,
      eventsCreateService,
      service,
    } = createService();
    const tx = {};

    await service.create(
      {
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
        ],
        extension: {
          equipmentVisibleId: 1001,
          maintenanceTypeId: 10,
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibleUserIds: ['user-1'],
        source: EventSource.MANUAL,
        title: 'Equipment event',
      },
      'user-1',
    );

    const options = eventsCreateService.create.mock.calls[0]?.[2];

    await options?.createExtension?.({
      eventId: 25,
      tx: tx as never,
    });
    await options?.createChecklists?.({
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
      ],
      createdBy: 'user-1',
      eventId: 25,
      tx: tx as never,
    });

    expect(
      equipmentExtensionService.assertChecklistTemplatesAllowed,
    ).toHaveBeenCalledWith(tx, 50, [11]);
    expect(checklistCreator.createEventChecklists).toHaveBeenCalledWith(tx, {
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
      ],
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

  it('delegates responsible users to query service', async () => {
    const { queryService, service } = createService();

    await expect(service.findResponsibleUsers()).resolves.toEqual({
      users: [],
    });

    expect(queryService.findResponsibleUsers).toHaveBeenCalledTimes(1);
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

  it('updates equipment extension through generic update resolver', async () => {
    const {
      checklistCreator,
      equipmentExtensionService,
      queryService,
      service,
      updateService,
    } = createService();
    updateService.updateCreated.mockImplementation(
      async (_checklistCreator, eventId, _data, _userId, resolver) => {
        const options = await resolver?.({
          currentState: {
            currentChecklists: [],
            currentNote: null,
            currentPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
            currentResponsibleUserIds: ['user-1'],
            currentTitle: 'Title',
            version: 1,
          },
          eventId,
          tx: {} as never,
        });

        await options?.updateExtension?.({
          eventId,
          tx: {} as never,
        });
        await options?.afterUpdate?.({
          eventId,
          tx: {} as never,
        });

        return {
          eventId,
          updated: true,
        };
      },
    );
    equipmentExtensionService.prepareUpdateCreated.mockResolvedValue({
      equipmentId: 200,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 60,
      maintenanceSetting: undefined,
    });

    await service.updateCreated(
      1,
      {
        extension: {
          equipmentVisibleId: 1002,
        },
        version: 2,
      },
      'user-1',
    );

    expect(updateService.updateCreated).toHaveBeenCalledWith(
      checklistCreator,
      1,
      { version: 2 },
      'user-1',
      expect.any(Function),
    );
    expect(equipmentExtensionService.prepareUpdateCreated).toHaveBeenCalledWith(
      expect.anything(),
      1,
      {
        equipmentVisibleId: 1002,
      },
    );
    expect(equipmentExtensionService.updateCreated).toHaveBeenCalled();
    expect(writeEquipmentEventUpdatedAuditMock).toHaveBeenCalled();
    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  it('does not attach equipment audit when extension payload has no changes', async () => {
    const { equipmentExtensionService, service, updateService } =
      createService();
    updateService.updateCreated.mockImplementation(
      async (_checklistCreator, eventId, _data, _userId, resolver) => {
        const options = await resolver?.({
          currentState: {
            currentChecklists: [],
            currentNote: null,
            currentPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
            currentResponsibleUserIds: ['user-1'],
            currentTitle: 'Title',
            version: 1,
          },
          eventId,
          tx: {} as never,
        });

        expect(options).toMatchObject({
          hasExtensionChanges: false,
          requiresChecklistAssignments: false,
        });
        expect(options?.afterUpdate).toBeUndefined();
        expect(options?.updateExtension).toBeUndefined();

        return {
          eventId,
          updated: true,
        };
      },
    );

    await service.updateCreated(
      1,
      {
        extension: {},
        title: 'Updated title',
        version: 2,
      },
      'user-1',
    );

    expect(equipmentExtensionService.prepareUpdateCreated).toHaveBeenCalled();
    expect(getEquipmentEventAuditSnapshotMock).not.toHaveBeenCalled();
    expect(writeEquipmentEventUpdatedAuditMock).not.toHaveBeenCalled();
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
