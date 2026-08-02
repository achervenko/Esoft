import {
  EquipmentMaintenanceExecutionType,
  EventExtensionCode,
} from '@prisma/client';
import {
  toEquipmentEventExtensionDetailResponse,
  toEquipmentEventExtensionListResponse,
} from './equipment-event-extension.presenter';

describe('equipment event extension presenter', () => {
  it('presents list response', () => {
    const response = toEquipmentEventExtensionListResponse({
      equipment: {
        id: 100,
        model: {
          id: 20,
          name: 'Model',
        },
        name: 'Pump',
        section: {
          id: 10,
          name: 'Line 1',
          workshop: {
            id: 11,
            name: 'Workshop',
          },
        },
        visibleId: 5001,
      },
      eventType: {
        code: 'MAINTENANCE',
        id: 40,
        name: 'ТО',
      },
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      maintenanceSettingId: 50,
    });

    expect(response).toEqual({
      code: EventExtensionCode.EQUIPMENT,
      maintenanceSettingId: 50,
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      equipment: {
        id: 100,
        model: {
          id: 20,
          name: 'Model',
        },
        location: 'Workshop / Line 1',
        name: 'Pump',
        section: {
          id: 10,
          name: 'Line 1',
          workshop: {
            id: 11,
            name: 'Workshop',
          },
        },
        visibleId: 5001,
      },
      maintenanceType: {
        code: 'MAINTENANCE',
        id: 40,
        name: 'ТО',
      },
    });
  });

  it('presents detail response with manufacturer', () => {
    const response = toEquipmentEventExtensionDetailResponse({
      equipment: {
        id: 100,
        model: {
          id: 20,
          manufacturer: {
            id: 30,
            name: 'Maker',
          },
          name: 'Model',
        },
        name: 'Pump',
        visibleId: 5001,
      },
      eventType: {
        code: 'MAINTENANCE',
        id: 40,
        name: 'ТО',
      },
      executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
      maintenanceSettingId: 50,
    });

    expect(response.equipment.model).toEqual({
      id: 20,
      manufacturer: {
        id: 30,
        name: 'Maker',
      },
      name: 'Model',
    });
    expect(response).toMatchObject({
      code: EventExtensionCode.EQUIPMENT,
      executionType: EquipmentMaintenanceExecutionType.EXTERNAL,
      maintenanceSettingId: 50,
    });
  });
});
