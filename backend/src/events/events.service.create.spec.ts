jest.mock(
  '../equipment-event-extension/equipment-event-extension.audit',
  () => ({
    getEquipmentEventExtensionAuditSnapshot: jest.fn(),
    writeEquipmentEventExtensionCreatedAudit: jest.fn(),
    writeEquipmentEventExtensionUpdatedAudit: jest.fn(),
  }),
);

import { EventExtensionCode, EventSource } from '@prisma/client';
import type { CreateEventCommand } from './events-create.types';
import {
  createService,
  resetEventsServiceMocks,
  writeEquipmentEventExtensionCreatedAuditMock,
} from './events-service.spec-fixtures';

describe('EventsService create', () => {
  beforeEach(resetEventsServiceMocks);

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
      extensionContext: undefined,
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
      extensionContext: undefined,
      eventId: 25,
      tx: tx as never,
    });
    expect(writeEquipmentEventExtensionCreatedAuditMock).toHaveBeenCalledWith(
      tx,
      {
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
      },
    );
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

    const extensionContext = await options?.createExtension?.({
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
      extensionContext,
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
});
