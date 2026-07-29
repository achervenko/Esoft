import { ConflictException } from '@nestjs/common';
import {
  EquipmentMaintenanceExecutionType,
  EventExtensionCode,
  EventSource,
  EventStatus,
} from '@prisma/client';
import { EquipmentEventExtensionAdapter } from '../equipment-event-extension/equipment-event-extension.adapter';
import { EquipmentEventExtensionCreate } from '../equipment-event-extension/equipment-event-extension.create';
import { EquipmentEventExtensionQuery } from '../equipment-event-extension/equipment-event-extension.query';
import { EquipmentEventExtensionUpdate } from '../equipment-event-extension/equipment-event-extension.update';
import { EquipmentEventExtensionValidation } from '../equipment-event-extension/equipment-event-extension.validation';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import {
  toEventDetailResponse as toEventDetailResponseBase,
  toEventListResponse as toEventListResponseBase,
} from './events.presenter';

const extensionRegistry = new EventExtensionRegistry([
  createEquipmentEventExtensionAdapter(),
]);
const toEventListResponse = (
  event: Parameters<typeof toEventListResponseBase>[0],
  checklists?: Parameters<typeof toEventListResponseBase>[2],
) => toEventListResponseBase(event, extensionRegistry, checklists);
const toEventDetailResponse = (
  event: Parameters<typeof toEventDetailResponseBase>[0],
  checklists?: Parameters<typeof toEventDetailResponseBase>[2],
) => toEventDetailResponseBase(event, extensionRegistry, checklists);

function createEquipmentEventExtensionAdapter(): EquipmentEventExtensionAdapter {
  const validation = new EquipmentEventExtensionValidation();

  return new EquipmentEventExtensionAdapter(
    new EquipmentEventExtensionCreate({} as never),
    new EquipmentEventExtensionUpdate({} as never),
    new EquipmentEventExtensionQuery(validation),
    validation,
  );
}

describe('events presenter', () => {
  it('presents standalone event without extension', () => {
    const response = toEventListResponse({
      equipmentExtension: null,
      extensionCode: null,
      factDate: null,
      id: 1,
      note: 'note',
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibles: [],
      source: EventSource.MANUAL,
      status: EventStatus.CREATED,
      title: 'Standalone event',
      version: 1,
    });

    expect(response).toMatchObject({
      id: 1,
      title: 'Standalone event',
      extensionCode: null,
      extension: null,
      plannedDate: '2026-08-01',
      checklists: [],
      responsibles: [],
    });
  });

  it('presents equipment extension when present', () => {
    const response = toEventDetailResponse(
      {
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        createdByEmployee: {
          firstName: 'Иван',
          id: 10,
          lastName: 'Петров',
          middleName: null,
          position: 'Инженер',
        },
        equipmentExtension: {
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
          executionType: EquipmentMaintenanceExecutionType.INTERNAL,
          maintenanceSettingId: 50,
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
        factDate: null,
        id: 2,
        note: null,
        originalPlannedDate: null,
        plannedDate: new Date('2026-08-02T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Equipment event',
        version: 1,
      },
      [],
    );

    expect(response.extension).toEqual({
      code: EventExtensionCode.EQUIPMENT,
      maintenanceSettingId: 50,
      executionType: EquipmentMaintenanceExecutionType.INTERNAL,
      equipment: {
        id: 100,
        visibleId: 5001,
        name: 'Pump',
        model: {
          id: 20,
          manufacturer: {
            id: 30,
            name: 'Maker',
          },
          name: 'Model',
        },
      },
      maintenanceType: {
        code: 'MAINTENANCE',
        id: 40,
        name: 'ТО',
      },
    });
  });

  it('rejects relation without extension code', () => {
    const action = () =>
      toEventListResponse({
        equipmentExtension: {
          equipment: {
            id: 100,
            model: {
              id: 20,
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
          executionType: EquipmentMaintenanceExecutionType.INTERNAL,
          maintenanceSettingId: 50,
        },
        extensionCode: null,
        factDate: null,
        id: 3,
        note: null,
        plannedDate: new Date('2026-08-03T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Broken event',
        version: 1,
      });

    expect(action).toThrow(ConflictException);

    const error = readThrownError(action);

    expect((error as ConflictException).getResponse()).toEqual({
      code: 'EVENT_EXTENSION_CONFLICT',
      message: 'Данные расширения события не соответствуют его типу.',
    });
  });

  it('rejects equipment extension code without relation', () => {
    expect(() =>
      toEventListResponse({
        equipmentExtension: null,
        extensionCode: EventExtensionCode.EQUIPMENT,
        factDate: null,
        id: 4,
        note: null,
        plannedDate: new Date('2026-08-04T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Broken equipment event',
        version: 1,
      }),
    ).toThrow('Расширение оборудования для события не найдено.');
  });
});

function readThrownError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);

    return error as Error;
  }

  throw new Error('Expected exception');
}
