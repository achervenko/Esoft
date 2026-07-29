import {
  EquipmentMaintenanceExecutionType,
  EquipmentStatus,
} from '@prisma/client';
import { EquipmentEventExtensionInputLoader } from './equipment-event-extension-input.loader';

describe('EquipmentEventExtensionInputLoader', () => {
  function createLoader() {
    return new EquipmentEventExtensionInputLoader();
  }

  it('rejects written-off equipment', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 1,
          model_id: 2,
          status: EquipmentStatus.WRITTEN_OFF,
        },
      ]),
    };

    await expect(
      loader.loadAndLockEquipmentByVisibleId(tx as never, 1001),
    ).rejects.toMatchObject({
      response: {
        code: 'EQUIPMENT_WRITTEN_OFF',
      },
    });
  });

  it('rejects missing equipment by visible id', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      loader.loadAndLockEquipmentByVisibleId(tx as never, 1001),
    ).rejects.toMatchObject({
      response: {
        code: 'EQUIPMENT_NOT_FOUND',
      },
    });
  });

  it('loads equipment by id', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 1,
          model_id: 2,
          status: EquipmentStatus.ACTIVE,
        },
      ]),
    };

    await expect(
      loader.loadAndLockEquipmentById(tx as never, 1),
    ).resolves.toEqual({
      id: 1,
      modelId: 2,
    });
  });

  it('rejects missing equipment by id', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      loader.loadAndLockEquipmentById(tx as never, 1),
    ).rejects.toMatchObject({
      response: {
        code: 'EQUIPMENT_NOT_FOUND',
      },
    });
  });

  it('rejects missing maintenance type', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      loader.loadActiveApplicableMaintenanceSetting(tx as never, {
        equipmentModelId: 20,
        maintenanceTypeId: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'MAINTENANCE_TYPE_NOT_FOUND',
      },
    });
  });

  it('rejects inactive maintenance type', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValueOnce([
        {
          id: 10,
          is_active: false,
        },
      ]),
    };

    await expect(
      loader.loadActiveApplicableMaintenanceSetting(tx as never, {
        equipmentModelId: 20,
        maintenanceTypeId: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'MAINTENANCE_TYPE_INACTIVE',
      },
    });
  });

  it('rejects missing maintenance setting', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 10,
            is_active: true,
          },
        ])
        .mockResolvedValueOnce([]),
    };

    await expect(
      loader.loadActiveApplicableMaintenanceSetting(tx as never, {
        equipmentModelId: 20,
        maintenanceTypeId: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'MAINTENANCE_SETTING_NOT_FOUND',
      },
    });
  });

  it('loads active applicable maintenance setting', async () => {
    const loader = createLoader();
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 10,
            is_active: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            execution_type: EquipmentMaintenanceExecutionType.INTERNAL,
            id: 30,
          },
        ]),
    };

    await expect(
      loader.loadActiveApplicableMaintenanceSetting(tx as never, {
        equipmentModelId: 20,
        maintenanceTypeId: 10,
      }),
    ).resolves.toEqual({
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      id: 30,
    });
  });
});
