import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import { parseEventsListQueryDto } from './events-list.validation';

describe('events list validation', () => {
  it('uses default pagination without filters', () => {
    expect(parseEventsListQueryDto(undefined)).toEqual({
      limit: 50,
      offset: 0,
      where: {},
    });
  });

  it('parses generic list query filters', () => {
    expect(
      parseEventsListQueryDto({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        extensionCode: EventExtensionCode.EQUIPMENT,
        limit: '25',
        offset: '10',
        responsibleUserId: 'user-1',
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
      }),
    ).toEqual({
      limit: 25,
      offset: 10,
      where: {
        extensionCode: EventExtensionCode.EQUIPMENT,
        plannedDate: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lt: new Date('2026-09-01T00:00:00.000Z'),
        },
        responsibles: {
          some: {
            userId: 'user-1',
          },
        },
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
      },
    });
  });

  it('treats dateTo as inclusive day boundary', () => {
    expect(
      parseEventsListQueryDto({
        dateTo: '2026-08-01',
      }),
    ).toEqual({
      limit: 50,
      offset: 0,
      where: {
        plannedDate: {
          lt: new Date('2026-08-02T00:00:00.000Z'),
        },
      },
    });
  });

  it('parses equipment list filters through extension relation', () => {
    expect(
      parseEventsListQueryDto({
        equipmentVisibleId: '1001',
        extensionCode: EventExtensionCode.EQUIPMENT,
        maintenanceTypeId: '10',
      }),
    ).toEqual({
      limit: 50,
      offset: 0,
      where: {
        equipmentExtension: {
          is: {
            equipment: {
              visibleId: 1001,
            },
            eventTypeId: 10,
          },
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
    });
  });

  it.each([
    {
      label: 'equipment',
      query: {
        equipmentVisibleId: '1001',
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
      where: {
        equipmentExtension: {
          is: {
            equipment: {
              visibleId: 1001,
            },
          },
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
    },
    {
      label: 'maintenance type',
      query: {
        extensionCode: EventExtensionCode.EQUIPMENT,
        maintenanceTypeId: '10',
      },
      where: {
        equipmentExtension: {
          is: {
            eventTypeId: 10,
          },
        },
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
    },
  ])('parses $label list filter separately', ({ query, where }) => {
    expect(parseEventsListQueryDto(query)).toEqual({
      limit: 50,
      offset: 0,
      where,
    });
  });

  it.each([
    {
      label: 'missing extension code',
      query: { equipmentVisibleId: '1001' },
    },
    {
      label: 'standalone extension code',
      query: {
        equipmentVisibleId: '1001',
        extensionCode: 'NONE',
      },
    },
  ])('rejects equipment filters with $label', ({ query }) => {
    expect(() => parseEventsListQueryDto(query)).toThrow(
      'Фильтры оборудования доступны только для событий оборудования.',
    );
  });

  it.each([
    {
      extensionCode: '',
      label: 'empty value',
    },
    {
      extensionCode: 'NONE',
      label: 'NONE',
    },
  ])('parses standalone list filter from $label', ({ extensionCode }) => {
    expect(parseEventsListQueryDto({ extensionCode })).toEqual({
      limit: 50,
      offset: 0,
      where: {
        extensionCode: null,
      },
    });
  });

  it.each([
    {
      expectedMessage: 'Некорректный статус события.',
      query: { status: 'UNKNOWN' },
    },
    {
      expectedMessage: 'Некорректный источник события.',
      query: { source: 'UNKNOWN' },
    },
    {
      expectedMessage: 'Некорректный тип расширения события.',
      query: { extensionCode: 'UNKNOWN' },
    },
    {
      expectedMessage: 'Некорректный ID оборудования.',
      query: {
        equipmentVisibleId: '0',
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
    },
    {
      expectedMessage: 'Некорректный вид обслуживания.',
      query: {
        extensionCode: EventExtensionCode.EQUIPMENT,
        maintenanceTypeId: '1.5',
      },
    },
    {
      expectedMessage: 'Некорректная дата начала периода.',
      query: { dateFrom: '2026-02-31' },
    },
    {
      expectedMessage: 'Некорректная дата окончания периода.',
      query: { dateTo: '2026-02-31' },
    },
    {
      expectedMessage:
        'Дата начала периода не может быть позже даты окончания.',
      query: {
        dateFrom: '2026-08-31',
        dateTo: '2026-08-01',
      },
    },
    {
      expectedMessage: 'Некорректный лимит списка событий.',
      query: { limit: '101' },
    },
    {
      expectedMessage: 'Некорректное смещение списка событий.',
      query: { offset: '-1' },
    },
  ])('rejects invalid list query %#', ({ expectedMessage, query }) => {
    expect(() => parseEventsListQueryDto(query)).toThrow(expectedMessage);
  });

  it.each([
    {
      expectedMessage: 'Некорректный лимит списка событий.',
      query: { limit: '0' },
    },
    {
      expectedMessage: 'Некорректный лимит списка событий.',
      query: { limit: '1.5' },
    },
    {
      expectedMessage: 'Некорректный лимит списка событий.',
      query: { limit: '01' },
    },
    {
      expectedMessage: 'Некорректный лимит списка событий.',
      query: { limit: String(Number.MAX_SAFE_INTEGER + 1) },
    },
    {
      expectedMessage: 'Некорректное смещение списка событий.',
      query: { offset: '1.5' },
    },
    {
      expectedMessage: 'Некорректное смещение списка событий.',
      query: { offset: '01' },
    },
    {
      expectedMessage: 'Некорректное смещение списка событий.',
      query: { offset: String(Number.MAX_SAFE_INTEGER + 1) },
    },
  ])('rejects invalid pagination query %#', ({ expectedMessage, query }) => {
    expect(() => parseEventsListQueryDto(query)).toThrow(expectedMessage);
  });
});
