import { EquipmentMaintenanceExecutionType } from '@prisma/client';
import type { PreparedEquipmentEventExtensionUpdate } from '../equipment-event-extension/equipment-event-extension.command.types';
import type { EventsUpdateService } from '../events/events-update.service';
import type { EventUpdateExtensionOptionsResolver } from '../events/events-update.types';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventsUpdateService } from './equipment-events-update.service';

jest.mock('./equipment-events.audit', () => ({
  getEquipmentEventAuditSnapshot: jest.fn(),
  writeEquipmentEventUpdatedAudit: jest.fn(),
}));

const getEquipmentEventAuditSnapshotMock =
  getEquipmentEventAuditSnapshot as jest.MockedFunction<
    typeof getEquipmentEventAuditSnapshot
  >;
const writeEquipmentEventUpdatedAuditMock =
  writeEquipmentEventUpdatedAudit as jest.MockedFunction<
    typeof writeEquipmentEventUpdatedAudit
  >;

describe('EquipmentEventsUpdateService', () => {
  function createPreparedExtension(
    overrides: Partial<PreparedEquipmentEventExtensionUpdate> = {},
  ): PreparedEquipmentEventExtensionUpdate {
    return {
      equipmentId: undefined,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 30,
      maintenanceSetting: undefined,
      ...overrides,
    };
  }

  function createSnapshot(id: number) {
    return {
      equipmentName: `Equipment ${id}`,
      equipmentVisibleId: id,
      eventTypeCode: `TYPE_${id}`,
      eventTypeId: id,
      eventTypeName: `Type ${id}`,
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      id: 1,
      maintenanceSettingId: id,
    };
  }

  function createCurrentState() {
    return {
      currentChecklists: [],
      currentNote: null,
      currentPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      currentResponsibleUserIds: ['user-1'],
      currentTitle: 'Title',
      version: 1,
    };
  }

  function createService() {
    const checklistCreator = {
      createEventChecklists: jest.fn(),
    };
    const equipmentExtensionService = {
      assertChecklistTemplatesAllowed: jest.fn().mockResolvedValue(undefined),
      prepareUpdateCreated: jest
        .fn()
        .mockResolvedValue(createPreparedExtension()),
      updateCreated: jest.fn().mockResolvedValue(undefined),
    };
    const tx = {};
    const updateCreatedInTransaction: jest.MockedFunction<
      EventsUpdateService['updateCreatedInTransaction']
    > = jest.fn((_tx, _checklistCreator, eventId) =>
      Promise.resolve({
        eventId,
        updated: true,
      }),
    );
    const eventsUpdateService = {
      updateCreatedInTransaction,
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof tx) => Promise<number>) =>
        callback(tx),
      ),
    };
    const queryResponse = { id: 1 };
    const queryService = {
      findOne: jest.fn().mockResolvedValue(queryResponse),
    };
    const service = new EquipmentEventsUpdateService(
      checklistCreator as never,
      equipmentExtensionService as never,
      eventsUpdateService as never,
      prisma as never,
      queryService as never,
    );

    return {
      checklistCreator,
      equipmentExtensionService,
      eventsUpdateService,
      prisma,
      queryResponse,
      queryService,
      service,
      tx,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens transaction in adapter and passes transaction to generic update', async () => {
    const { checklistCreator, eventsUpdateService, prisma, service, tx } =
      createService();

    await service.updateCreated(1, { version: 1 }, 'user-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventsUpdateService.updateCreatedInTransaction).toHaveBeenCalledWith(
      tx,
      checklistCreator,
      1,
      { version: 1 },
      'user-1',
      expect.any(Function),
    );
  });

  it('prepares equipment update inside resolver after generic update starts', async () => {
    const { equipmentExtensionService, eventsUpdateService, service, tx } =
      createService();
    const calls: string[] = [];
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        calls.push('generic');
        await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: false,
        };
      },
    );
    equipmentExtensionService.prepareUpdateCreated.mockImplementation(() => {
      calls.push('prepare');
      return Promise.resolve(createPreparedExtension());
    });
    getEquipmentEventAuditSnapshotMock.mockImplementation(() => {
      calls.push('old-snapshot');
      return Promise.resolve(createSnapshot(10));
    });

    await service.updateCreated(1, { version: 1 }, 'user-1');

    expect(calls).toEqual(['generic', 'prepare', 'old-snapshot']);
  });

  it('returns updateExtension when equipment extension changes', async () => {
    const { equipmentExtensionService, eventsUpdateService, service, tx } =
      createService();
    const preparedExtension = createPreparedExtension({
      equipmentId: 10,
    });
    equipmentExtensionService.prepareUpdateCreated.mockResolvedValue(
      preparedExtension,
    );
    let capturedOptions:
      Awaited<ReturnType<EventUpdateExtensionOptionsResolver>> | undefined;
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        capturedOptions = await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: true,
        };
      },
    );

    await service.updateCreated(1, { version: 1 }, 'user-1');
    await capturedOptions?.updateExtension?.({
      eventId: 1,
      tx: tx as never,
    });

    expect(capturedOptions).toMatchObject({
      hasExtensionChanges: true,
      requiresChecklistAssignments: true,
    });
    expect(capturedOptions?.updateExtension).toBeDefined();
    expect(capturedOptions?.validateChecklists).toBeDefined();
    expect(equipmentExtensionService.updateCreated).toHaveBeenCalledWith(
      tx,
      1,
      preparedExtension,
    );
  });

  it('does not return updateExtension when equipment extension has no changes', async () => {
    const { eventsUpdateService, service, tx } = createService();
    let capturedOptions:
      Awaited<ReturnType<EventUpdateExtensionOptionsResolver>> | undefined;
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        capturedOptions = await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: false,
        };
      },
    );

    await service.updateCreated(1, { version: 1 }, 'user-1');

    expect(capturedOptions).toMatchObject({
      hasExtensionChanges: false,
      requiresChecklistAssignments: false,
    });
    expect(capturedOptions?.updateExtension).toBeUndefined();
  });

  it('validates checklist templates against final maintenance setting', async () => {
    const { equipmentExtensionService, eventsUpdateService, service, tx } =
      createService();
    const preparedExtension = createPreparedExtension({
      finalMaintenanceSettingId: 44,
    });
    equipmentExtensionService.prepareUpdateCreated.mockResolvedValue(
      preparedExtension,
    );
    let capturedOptions:
      Awaited<ReturnType<EventUpdateExtensionOptionsResolver>> | undefined;
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        capturedOptions = await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: false,
        };
      },
    );

    await service.updateCreated(1, { version: 1 }, 'user-1');
    await capturedOptions?.validateChecklists?.({
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
        {
          assignedUserId: 'user-2',
          checklistTemplateId: 12,
        },
      ],
      tx: tx as never,
    });

    expect(
      equipmentExtensionService.assertChecklistTemplatesAllowed,
    ).toHaveBeenCalledWith(tx, 44, [11, 12]);
  });

  it('writes equipment audit after successful update', async () => {
    const { eventsUpdateService, service, tx } = createService();
    const oldSnapshot = createSnapshot(10);
    const newSnapshot = createSnapshot(20);
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: true,
        };
      },
    );
    getEquipmentEventAuditSnapshotMock
      .mockReset()
      .mockResolvedValueOnce(oldSnapshot)
      .mockResolvedValueOnce(newSnapshot);

    await service.updateCreated(1, { version: 1 }, 'user-1');

    expect(writeEquipmentEventUpdatedAuditMock).toHaveBeenCalledWith(tx, {
      oldEvent: oldSnapshot,
      newEvent: newSnapshot,
      userId: 'user-1',
    });
  });

  it('does not load detail or write audit when generic update fails', async () => {
    const { eventsUpdateService, queryService, service } = createService();
    eventsUpdateService.updateCreatedInTransaction.mockRejectedValue(
      new Error('generic update failed'),
    );

    await expect(
      service.updateCreated(1, { version: 1 }, 'user-1'),
    ).rejects.toThrow('generic update failed');

    expect(getEquipmentEventAuditSnapshotMock).not.toHaveBeenCalled();
    expect(writeEquipmentEventUpdatedAuditMock).not.toHaveBeenCalled();
    expect(queryService.findOne).not.toHaveBeenCalled();
  });

  it('does not load detail or write audit when equipment extension preparation fails', async () => {
    const {
      equipmentExtensionService,
      eventsUpdateService,
      queryService,
      service,
      tx,
    } = createService();
    equipmentExtensionService.prepareUpdateCreated.mockRejectedValue(
      new Error('extension failed'),
    );
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: true,
        };
      },
    );

    await expect(
      service.updateCreated(1, { version: 1 }, 'user-1'),
    ).rejects.toThrow('extension failed');

    expect(writeEquipmentEventUpdatedAuditMock).not.toHaveBeenCalled();
    expect(queryService.findOne).not.toHaveBeenCalled();
  });

  it('skips equipment audit on no-op update and returns compatibility response', async () => {
    const { eventsUpdateService, queryResponse, queryService, service, tx } =
      createService();
    eventsUpdateService.updateCreatedInTransaction.mockImplementation(
      async (
        _tx,
        _checklistCreator,
        eventId,
        _data,
        _userId,
        resolver: EventUpdateExtensionOptionsResolver,
      ) => {
        await resolver({
          currentState: createCurrentState(),
          eventId,
          tx,
        });

        return {
          eventId,
          updated: false,
        };
      },
    );
    getEquipmentEventAuditSnapshotMock.mockResolvedValueOnce(
      createSnapshot(10),
    );

    await expect(
      service.updateCreated(1, { version: 1 }, 'user-1'),
    ).resolves.toBe(queryResponse);

    expect(getEquipmentEventAuditSnapshotMock).toHaveBeenCalledTimes(1);
    expect(writeEquipmentEventUpdatedAuditMock).not.toHaveBeenCalled();
    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });
});
