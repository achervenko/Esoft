import { EventSource } from '@prisma/client';
import {
  parseCancelEventDto,
  parseCompleteEventDto,
  parseCreateEventDto,
  parseStartEventDto,
  parseUpdateCreatedEventDto,
} from './events.validation';

describe('events validation', () => {
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
      fieldName: 'extensionCode',
      payload: { extensionCode: 'EQUIPMENT' },
    },
    {
      fieldName: 'maintenanceTypeId',
      payload: { maintenanceTypeId: 10 },
    },
  ])('rejects create extension field $fieldName', ({ payload }) => {
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

  it('parses lifecycle payloads', () => {
    expect(parseStartEventDto({ version: 1 })).toEqual({ version: 1 });
    expect(parseCancelEventDto({ version: 2 })).toEqual({ version: 2 });
    expect(
      parseCompleteEventDto({
        factDate: '2026-08-01',
        version: 3,
      }),
    ).toEqual({
      factDate: new Date('2026-08-01T00:00:00.000Z'),
      version: 3,
    });
  });

  it.each([undefined, null, ''])(
    'treats empty fact date %p as not supplied',
    (factDate) => {
      expect(
        parseCompleteEventDto({
          factDate,
          version: 1,
        }),
      ).toEqual({
        factDate: undefined,
        version: 1,
      });
    },
  );

  it('rejects lifecycle payload without version', () => {
    expect(() => parseStartEventDto({})).toThrow('Укажите версию события.');
    expect(() => parseCompleteEventDto({})).toThrow('Укажите версию события.');
    expect(() => parseCancelEventDto({})).toThrow('Укажите версию события.');
  });

  it('rejects normalized invalid fact date', () => {
    expect(() =>
      parseCompleteEventDto({
        factDate: '2026-02-31',
        version: 1,
      }),
    ).toThrow('Некорректная фактическая дата.');
  });

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
      fieldName: 'extensionCode',
      payload: { extensionCode: 'EQUIPMENT' },
    },
    {
      fieldName: 'maintenanceTypeId',
      payload: { maintenanceTypeId: 10 },
    },
  ])('rejects update extension field $fieldName', ({ payload }) => {
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
