import {
  EquipmentMaintenanceExecutionType,
  EventExtensionCode,
} from '@prisma/client';
import { EquipmentEventExtensionService } from './equipment-event-extension.service';

describe('EquipmentEventExtensionService', () => {
  function createService() {
    const inputLoader = {
      loadActiveApplicableMaintenanceSetting: jest.fn(),
      loadAndLockEquipmentById: jest.fn(),
      loadAndLockEquipmentByVisibleId: jest.fn(),
    };

    return {
      inputLoader,
      service: new EquipmentEventExtensionService(inputLoader),
    };
  }

  it('prepareCreate returns extension ids and execution type', async () => {
    const { inputLoader, service } = createService();
    const tx = {};
    inputLoader.loadAndLockEquipmentByVisibleId.mockResolvedValue({
      id: 10,
      modelId: 20,
    });
    inputLoader.loadActiveApplicableMaintenanceSetting.mockResolvedValue({
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      id: 30,
    });

    await expect(
      service.prepareCreate(tx as never, {
        equipmentVisibleId: 1001,
        maintenanceTypeId: 40,
      }),
    ).resolves.toEqual({
      equipmentId: 10,
      eventTypeId: 40,
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      maintenanceSettingId: 30,
    });

    expect(inputLoader.loadAndLockEquipmentByVisibleId).toHaveBeenCalledWith(
      tx,
      1001,
    );
    expect(
      inputLoader.loadActiveApplicableMaintenanceSetting,
    ).toHaveBeenCalledWith(tx, {
      equipmentModelId: 20,
      maintenanceTypeId: 40,
    });
  });

  it('create writes exactly one extension row', async () => {
    const { service } = createService();
    const tx = {
      event: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
      equipmentEventExtension: {
        create: jest.fn(),
      },
    };

    await service.create(tx as never, 1, {
      equipmentId: 10,
      eventTypeId: 20,
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      maintenanceSettingId: 30,
    });

    expect(tx.event.findFirst).toHaveBeenCalledWith({
      where: {
        id: 1,
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
      select: {
        id: true,
      },
    });
    expect(tx.equipmentEventExtension.create).toHaveBeenCalledTimes(1);
    expect(tx.equipmentEventExtension.create).toHaveBeenCalledWith({
      data: {
        eventId: 1,
        equipmentId: 10,
        eventTypeId: 20,
        executionType: EquipmentMaintenanceExecutionType.INTERNAL,
        maintenanceSettingId: 30,
      },
    });
  });

  it('rejects create outside equipment event scope', async () => {
    const { service } = createService();
    const tx = {
      event: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      equipmentEventExtension: {
        create: jest.fn(),
      },
    };

    await expect(
      service.create(tx as never, 1, {
        equipmentId: 10,
        eventTypeId: 20,
        executionType: EquipmentMaintenanceExecutionType.INTERNAL,
        maintenanceSettingId: 30,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });

    expect(tx.equipmentEventExtension.create).not.toHaveBeenCalled();
  });

  it('prepareUpdateCreated uses current values when fields are omitted', async () => {
    const { inputLoader, service } = createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          equipmentExtension: {
            equipment: {
              id: 10,
              modelId: 20,
            },
            eventTypeId: 30,
            maintenanceSettingId: 40,
          },
          extensionCode: EventExtensionCode.EQUIPMENT,
          id: 1,
        }),
      },
    };
    inputLoader.loadAndLockEquipmentById.mockResolvedValue({
      id: 10,
      modelId: 20,
    });

    await expect(
      service.prepareUpdateCreated(tx as never, 1, {}),
    ).resolves.toEqual({
      equipmentId: undefined,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 40,
      maintenanceSetting: undefined,
    });

    expect(inputLoader.loadAndLockEquipmentById).toHaveBeenCalledWith(tx, 10);
    expect(
      inputLoader.loadActiveApplicableMaintenanceSetting,
    ).not.toHaveBeenCalled();
  });

  it('rejects update outside equipment event scope', async () => {
    const { service } = createService();
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
      service.prepareUpdateCreated(tx as never, 1, {}),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });
  });

  it('prepareUpdateCreated recalculates maintenance setting on equipment/type change', async () => {
    const { inputLoader, service } = createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          equipmentExtension: {
            equipment: {
              id: 10,
              modelId: 20,
            },
            eventTypeId: 30,
            maintenanceSettingId: 40,
          },
          extensionCode: EventExtensionCode.EQUIPMENT,
          id: 1,
        }),
      },
    };
    inputLoader.loadAndLockEquipmentByVisibleId.mockResolvedValue({
      id: 50,
      modelId: 60,
    });
    inputLoader.loadActiveApplicableMaintenanceSetting.mockResolvedValue({
      executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
      id: 70,
    });

    await expect(
      service.prepareUpdateCreated(tx as never, 1, {
        equipmentVisibleId: 1002,
        maintenanceTypeId: 80,
      }),
    ).resolves.toEqual({
      equipmentId: 50,
      eventTypeId: 80,
      finalMaintenanceSettingId: 70,
      maintenanceSetting: {
        executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
        id: 70,
      },
    });

    expect(
      inputLoader.loadActiveApplicableMaintenanceSetting,
    ).toHaveBeenCalledWith(tx, {
      equipmentModelId: 60,
      maintenanceTypeId: 80,
    });
  });

  it('prepareUpdateCreated recalculates maintenance setting on type change', async () => {
    const { inputLoader, service } = createService();
    const tx = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          equipmentExtension: {
            equipment: {
              id: 10,
              modelId: 20,
            },
            eventTypeId: 30,
            maintenanceSettingId: 40,
          },
          extensionCode: EventExtensionCode.EQUIPMENT,
          id: 1,
        }),
      },
    };
    inputLoader.loadAndLockEquipmentById.mockResolvedValue({
      id: 10,
      modelId: 20,
    });
    inputLoader.loadActiveApplicableMaintenanceSetting.mockResolvedValue({
      executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
      id: 70,
    });

    await expect(
      service.prepareUpdateCreated(tx as never, 1, {
        maintenanceTypeId: 80,
      }),
    ).resolves.toEqual({
      equipmentId: undefined,
      eventTypeId: 80,
      finalMaintenanceSettingId: 70,
      maintenanceSetting: {
        executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
        id: 70,
      },
    });

    expect(inputLoader.loadAndLockEquipmentById).toHaveBeenCalledWith(tx, 10);
    expect(
      inputLoader.loadActiveApplicableMaintenanceSetting,
    ).toHaveBeenCalledWith(tx, {
      equipmentModelId: 20,
      maintenanceTypeId: 80,
    });
  });

  it('updateCreated changes only extension fields', async () => {
    const { service } = createService();
    const tx = {
      equipmentEventExtension: {
        update: jest.fn(),
      },
    };

    await service.updateCreated(tx as never, 1, {
      equipmentId: 10,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 30,
      maintenanceSetting: {
        executionType: EquipmentMaintenanceExecutionType.INTERNAL,
        id: 30,
      },
    });

    expect(tx.equipmentEventExtension.update).toHaveBeenCalledWith({
      where: { eventId: 1 },
      data: {
        equipmentId: 10,
        executionType: EquipmentMaintenanceExecutionType.INTERNAL,
        maintenanceSettingId: 30,
      },
    });
  });

  it('does not update extension when prepared update has no changes', async () => {
    const { service } = createService();
    const tx = {
      equipmentEventExtension: {
        update: jest.fn(),
      },
    };

    await service.updateCreated(tx as never, 1, {
      equipmentId: undefined,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 30,
      maintenanceSetting: undefined,
    });

    expect(tx.equipmentEventExtension.update).not.toHaveBeenCalled();
  });

  it('validates checklist templates against maintenance setting', async () => {
    const { service } = createService();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ default_checklist_template_id: 200 }])
        .mockResolvedValueOnce([{ id: 200 }]),
    };

    await service.assertChecklistTemplatesAllowed(tx as never, 100, [200, 200]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('skips checklist validation when template list is empty', async () => {
    const { service } = createService();
    const tx = {
      $queryRaw: jest.fn(),
    };

    await service.assertChecklistTemplatesAllowed(tx as never, 100, []);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects inactive checklist template', async () => {
    const { service } = createService();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ default_checklist_template_id: 200 }])
        .mockResolvedValueOnce([]),
    };

    await expect(
      service.assertChecklistTemplatesAllowed(tx as never, 100, [200]),
    ).rejects.toMatchObject({
      response: {
        code: 'CHECKLIST_TEMPLATE_INACTIVE',
      },
    });
  });

  it('rejects checklist when maintenance setting has no default template', async () => {
    const { service } = createService();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValueOnce([
        {
          default_checklist_template_id: null,
        },
      ]),
    };

    await expect(
      service.assertChecklistTemplatesAllowed(tx as never, 100, [200]),
    ).rejects.toMatchObject({
      response: {
        code: 'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
      },
    });
  });

  it('rejects checklist template outside maintenance setting', async () => {
    const { service } = createService();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ default_checklist_template_id: 200 }]),
    };

    await expect(
      service.assertChecklistTemplatesAllowed(tx as never, 100, [201]),
    ).rejects.toMatchObject({
      response: {
        code: 'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
      },
    });
  });
});
