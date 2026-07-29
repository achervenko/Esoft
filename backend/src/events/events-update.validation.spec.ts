import { EventExtensionCode } from '@prisma/client';
import { parseUpdateCreatedEventDto } from './events-update.validation';

describe('events update validation', () => {
  it('parses generic update payload', () => {
    expect(
      parseUpdateCreatedEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
        ],
        note: '',
        plannedDate: '2026-08-01',
        responsibleUserIds: ['user-1', 'user-1'],
        title: ' Updated event ',
        version: 3,
      }),
    ).toEqual({
      checklistAssignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
      ],
      note: null,
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibleUserIds: ['user-1'],
      title: 'Updated event',
      version: 3,
    });
  });

  it('parses equipment update extension payload', () => {
    expect(
      parseUpdateCreatedEventDto({
        extension: {
          equipmentVisibleId: 1001,
          maintenanceTypeId: 10,
        },
        version: 3,
      }),
    ).toEqual({
      extension: {
        equipmentVisibleId: 1001,
        maintenanceTypeId: 10,
      },
      version: 3,
    });
  });

  it('allows empty update extension object as no-op candidate', () => {
    expect(
      parseUpdateCreatedEventDto({
        extension: {},
        version: 3,
      }),
    ).toEqual({
      extension: {},
      version: 3,
    });
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
  ])('rejects update legacy extension field $fieldName', ({ payload }) => {
    expect(() =>
      parseUpdateCreatedEventDto({
        ...payload,
        title: 'Updated event',
        version: 1,
      }),
    ).toThrow(
      'Общий endpoint события не принимает поля расширения оборудования.',
    );
  });

  it('rejects update extension code changes', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        extensionCode: EventExtensionCode.EQUIPMENT,
        title: 'Updated event',
        version: 1,
      }),
    ).toThrow('Тип расширения события нельзя изменить.');
  });

  it('rejects unknown update extension fields', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        extension: {
          equipmentVisibleId: 1001,
          unexpected: true,
        },
        version: 1,
      }),
    ).toThrow('Расширение события содержит неподдерживаемое поле.');
  });

  it('rejects empty update payload except version', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        version: 1,
      }),
    ).toThrow('Укажите данные для изменения события.');
  });

  it('rejects update without version', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        title: 'Updated event',
      }),
    ).toThrow('Укажите версию события.');
  });

  it('rejects null checklist assignments', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        checklistAssignments: null,
        version: 1,
      }),
    ).toThrow('Некорректные назначения чек-листов.');
  });

  it('allows checklist assignments without supplied responsibles', () => {
    expect(
      parseUpdateCreatedEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-2',
            checklistTemplateId: 11,
          },
        ],
        version: 1,
      }),
    ).toEqual({
      checklistAssignments: [
        {
          assignedUserId: 'user-2',
          checklistTemplateId: 11,
        },
      ],
      version: 1,
    });
  });

  it('requires checklist assignments for all supplied responsibles', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
        ],
        responsibleUserIds: ['user-1', 'user-2'],
        version: 1,
      }),
    ).toThrow(
      'Назначения чек-листов должны полностью покрывать всех ответственных.',
    );
  });

  it('rejects checklist assignee outside supplied responsibles', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        checklistAssignments: [
          {
            assignedUserId: 'user-2',
            checklistTemplateId: 11,
          },
        ],
        responsibleUserIds: ['user-1'],
        version: 1,
      }),
    ).toThrow('Исполнитель чек-листа должен быть ответственным за событие.');
  });

  it('rejects duplicate checklist assignee', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
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
        version: 1,
      }),
    ).toThrow('Ответственному можно назначить только один чек-лист.');
  });

  it('rejects normalized invalid calendar date', () => {
    expect(() =>
      parseUpdateCreatedEventDto({
        plannedDate: '2026-02-31',
        version: 1,
      }),
    ).toThrow('Некорректная плановая дата.');
  });
});
