import { EventExtensionCode } from '@prisma/client';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';

describe('EquipmentEventChecklistCreator', () => {
  function createService() {
    const equipmentExtensionService = {
      assertChecklistTemplatesAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const eventChecklistCreator = {
      createEventChecklists: jest.fn().mockResolvedValue([
        {
          assignedUserId: 'user-1',
          id: 100,
        },
      ]),
    };
    const service = new EquipmentEventChecklistCreator(
      equipmentExtensionService as never,
      eventChecklistCreator as never,
    );

    return {
      equipmentExtensionService,
      eventChecklistCreator,
      service,
    };
  }

  it('validates equipment-specific templates and delegates persistence to generic creator', async () => {
    const { equipmentExtensionService, eventChecklistCreator, service } =
      createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          equipmentExtension: {
            maintenanceSettingId: 30,
          },
          extensionCode: EventExtensionCode.EQUIPMENT,
          id: 1,
        }),
      },
    };
    const assignments = [
      {
        assignedUserId: 'user-1',
        checklistTemplateId: 11,
      },
      {
        assignedUserId: 'user-2',
        checklistTemplateId: 11,
      },
    ];

    await expect(
      service.createEventChecklists(tx as never, {
        assignments,
        createdBy: 'user-1',
        eventId: 1,
        temporarySortOrders: [-1, -2],
        validateFullResponsibleCoverage: false,
      }),
    ).resolves.toEqual([
      {
        assignedUserId: 'user-1',
        id: 100,
      },
    ]);

    expect(
      equipmentExtensionService.assertChecklistTemplatesAllowed,
    ).toHaveBeenCalledWith(tx, 30, [11]);
    expect(eventChecklistCreator.createEventChecklists).toHaveBeenCalledWith(
      tx,
      {
        assignments,
        createdBy: 'user-1',
        eventId: 1,
        temporarySortOrders: [-1, -2],
        validateFullResponsibleCoverage: false,
      },
    );
  });

  it('rejects missing event before delegation', async () => {
    const { eventChecklistCreator, service } = createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      service.createEventChecklists(tx as never, {
        assignments: [],
        createdBy: 'user-1',
        eventId: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });

    expect(eventChecklistCreator.createEventChecklists).not.toHaveBeenCalled();
  });

  it('rejects event outside equipment extension scope before delegation', async () => {
    const { equipmentExtensionService, eventChecklistCreator, service } =
      createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          equipmentExtension: null,
          extensionCode: null,
          id: 1,
        }),
      },
    };

    await expect(
      service.createEventChecklists(tx as never, {
        assignments: [],
        createdBy: 'user-1',
        eventId: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_EXTENSION_REQUIRED',
      },
    });
    expect(
      equipmentExtensionService.assertChecklistTemplatesAllowed,
    ).not.toHaveBeenCalled();
    expect(eventChecklistCreator.createEventChecklists).not.toHaveBeenCalled();
  });
});
