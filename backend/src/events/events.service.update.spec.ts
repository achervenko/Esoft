jest.mock(
  '../equipment-event-extension/equipment-event-extension.audit',
  () => ({
    getEquipmentEventExtensionAuditSnapshot: jest.fn(),
    writeEquipmentEventExtensionCreatedAudit: jest.fn(),
    writeEquipmentEventExtensionUpdatedAudit: jest.fn(),
  }),
);

import { EventExtensionCode } from '@prisma/client';
import {
  createService,
  resetEventsServiceMocks,
  getEquipmentEventExtensionAuditSnapshotMock,
  writeEquipmentEventExtensionUpdatedAuditMock,
} from './events-service.spec-fixtures';

describe('EventsService update', () => {
  beforeEach(resetEventsServiceMocks);

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
            extensionCode: EventExtensionCode.EQUIPMENT,
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
    expect(writeEquipmentEventExtensionUpdatedAuditMock).toHaveBeenCalled();
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
            extensionCode: EventExtensionCode.EQUIPMENT,
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
    expect(getEquipmentEventExtensionAuditSnapshotMock).not.toHaveBeenCalled();
    expect(writeEquipmentEventExtensionUpdatedAuditMock).not.toHaveBeenCalled();
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
});
