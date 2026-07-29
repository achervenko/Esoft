import { EventExtensionCode, EventSource } from '@prisma/client';
import { EquipmentEventExtensionAdapter } from '../equipment-event-extension/equipment-event-extension.adapter';
import { EquipmentEventExtensionCreate } from '../equipment-event-extension/equipment-event-extension.create';
import { EquipmentEventExtensionQuery } from '../equipment-event-extension/equipment-event-extension.query';
import { EquipmentEventExtensionUpdate } from '../equipment-event-extension/equipment-event-extension.update';
import { EquipmentEventExtensionValidation } from '../equipment-event-extension/equipment-event-extension.validation';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import { parseCreateEventDto as parseCreateEventDtoBase } from './events-create.validation';

type ExceptionWithResponse = {
  getResponse: () => unknown;
};

const extensionRegistry = new EventExtensionRegistry([
  createEquipmentEventExtensionAdapter(),
]);
const parseCreateEventDto = (dto: Parameters<typeof parseCreateEventDtoBase>[0]) =>
  parseCreateEventDtoBase(dto, extensionRegistry);

function createEquipmentEventExtensionAdapter(): EquipmentEventExtensionAdapter {
  const validation = new EquipmentEventExtensionValidation();

  return new EquipmentEventExtensionAdapter(
    new EquipmentEventExtensionCreate({} as never),
    new EquipmentEventExtensionUpdate({} as never),
    new EquipmentEventExtensionQuery(validation),
    validation,
  );
}

describe('events create validation', () => {
  it('parses generic create payload', () => {
    expect(
      parseCreateEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
          {
            assignedUserId: 'user-2',
            checklistTemplateId: 12,
          },
        ],
        note: '',
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1', 'user-1', 'user-2'],
        title: ' Standalone event ',
      }),
    ).toEqual({
      checklistAssignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
        {
          assignedUserId: 'user-2',
          checklistTemplateId: 12,
        },
      ],
      extensionCode: null,
      note: null,
      originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibleUserIds: ['user-1', 'user-2'],
      source: EventSource.MANUAL,
      title: 'Standalone event',
    });
  });

  it('rejects create without title', () => {
    expect(() =>
      parseCreateEventDto({
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
      }),
    ).toThrow('Укажите название события.');
  });

  it('rejects create without planned date', () => {
    expect(() =>
      parseCreateEventDto({
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow('Укажите плановую дату события.');
  });

  it('rejects create with invalid planned date', () => {
    expect(() =>
      parseCreateEventDto({
        plannedDate: '2026-02-31',
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow('Некорректная плановая дата.');
  });

  it('parses equipment create payload', () => {
    expect(
      parseCreateEventDto({
        extension: {
          equipmentVisibleId: 1001,
          maintenanceTypeId: 10,
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
        title: 'Equipment event',
      }),
    ).toEqual({
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
    });
  });

  it('rejects unknown create extension code', () => {
    expectThrownResponse(
      () =>
        parseCreateEventDto({
          extensionCode: 'UNKNOWN',
          plannedDate: '2026-08-01',
          responsibleUserIds: ['user-1'],
          title: 'Equipment event',
        }),
      {
        code: 'EVENT_EXTENSION_CODE_INVALID',
        message: 'Некорректный тип расширения события.',
      },
    );
  });

  it.each([
    {
      fieldName: 'equipmentId',
      payload: { equipmentId: 1 },
    },
    {
      fieldName: 'equipmentVisibleId',
      payload: { equipmentVisibleId: 1001 },
    },
    {
      fieldName: 'maintenanceTypeId',
      payload: { maintenanceTypeId: 10 },
    },
  ])('rejects create legacy extension field $fieldName', ({ payload }) => {
    expect(() =>
      parseCreateEventDto({
        ...payload,
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow(
      'Общий endpoint события не принимает поля расширения оборудования.',
    );
  });

  it('rejects create extension data without extension code', () => {
    expect(() =>
      parseCreateEventDto({
        extension: {
          equipmentVisibleId: 1001,
          maintenanceTypeId: 10,
        },
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow(
      'Для события без типа расширения нельзя передавать данные расширения.',
    );
  });

  it('requires create extension data for equipment event', () => {
    expectThrownResponse(
      () =>
        parseCreateEventDto({
          extensionCode: EventExtensionCode.EQUIPMENT,
          plannedDate: '2026-08-01',
          responsibleUserIds: ['user-1'],
          title: 'Equipment event',
        }),
      {
        code: 'EVENT_EXTENSION_REQUIRED',
        message: 'Для события оборудования передайте данные расширения.',
      },
    );
  });

  it.each([
    {
      extension: null,
      label: 'null',
    },
    {
      extension: [],
      label: 'array',
    },
    {
      extension: 'equipment',
      label: 'string',
    },
  ])('rejects create extension as $label', ({ extension }) => {
    expectThrownResponse(
      () =>
        parseCreateEventDto({
          extension,
          extensionCode: EventExtensionCode.EQUIPMENT,
          plannedDate: '2026-08-01',
          responsibleUserIds: ['user-1'],
          title: 'Equipment event',
        }),
      {
        code: 'EVENT_EXTENSION_REQUIRED',
        message: 'Для события оборудования передайте данные расширения.',
      },
    );
  });

  it.each([
    {
      expectedResponse: {
        code: 'EQUIPMENT_INVALID',
        message: 'Некорректный ID оборудования.',
      },
      label: 'equipment visible id',
      payload: {
        equipmentVisibleId: 0,
        maintenanceTypeId: 10,
      },
    },
    {
      expectedResponse: {
        code: 'MAINTENANCE_TYPE_REQUIRED',
        message: 'Укажите вид обслуживания.',
      },
      label: 'maintenance type id',
      payload: {
        equipmentVisibleId: 1001,
        maintenanceTypeId: 'bad',
      },
    },
  ])(
    'rejects invalid $label in create extension',
    ({ expectedResponse, payload }) => {
      expectThrownResponse(
        () =>
          parseCreateEventDto({
            extension: payload,
            extensionCode: EventExtensionCode.EQUIPMENT,
            plannedDate: '2026-08-01',
            responsibleUserIds: ['user-1'],
            title: 'Equipment event',
          }),
        expectedResponse,
      );
    },
  );

  it('rejects unknown create extension fields', () => {
    expectThrownResponse(
      () =>
        parseCreateEventDto({
          extension: {
            equipmentVisibleId: 1001,
            maintenanceTypeId: 10,
            unexpected: true,
          },
          extensionCode: EventExtensionCode.EQUIPMENT,
          plannedDate: '2026-08-01',
          responsibleUserIds: ['user-1'],
          title: 'Equipment event',
        }),
      {
        code: 'EVENT_EXTENSION_FIELD_UNSUPPORTED',
        message: 'Расширение события содержит неподдерживаемое поле.',
      },
    );
  });

  it('rejects create checklist assignee outside supplied responsibles', () => {
    expect(() =>
      parseCreateEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-2',
            checklistTemplateId: 11,
          },
        ],
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow('Исполнитель чек-листа должен быть ответственным за событие.');
  });

  it('requires create checklist assignments for all responsibles', () => {
    expect(() =>
      parseCreateEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
        ],
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1', 'user-2'],
        title: 'Standalone event',
      }),
    ).toThrow(
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  });

  it('rejects duplicate create checklist assignee', () => {
    expect(() =>
      parseCreateEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 12,
          },
        ],
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1'],
        title: 'Standalone event',
      }),
    ).toThrow('Ответственному можно назначить только один чек-лист.');
  });
});

function expectThrownResponse(
  action: () => unknown,
  expectedResponse: {
    code: string;
    message: string;
  },
): void {
  try {
    action();
    throw new Error('Expected exception');
  } catch (error) {
    expect(readExceptionResponse(error)).toEqual(expectedResponse);
  }
}

function readExceptionResponse(error: unknown): unknown {
  if (hasExceptionResponse(error)) {
    return error.getResponse();
  }

  return undefined;
}

function hasExceptionResponse(error: unknown): error is ExceptionWithResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getResponse' in error &&
    typeof error.getResponse === 'function'
  );
}
