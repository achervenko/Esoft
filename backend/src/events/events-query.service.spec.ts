import {
  EquipmentMaintenanceExecutionType,
  EventExtensionCode,
  EventSource,
  EventStatus,
} from '@prisma/client';
import { EventsQueryService } from './events-query.service';

describe('EventsQueryService', () => {
  function createStandaloneEvent(overrides = {}) {
    return {
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      createdByEmployee: {
        firstName: 'Ivan',
        id: 5,
        lastName: 'Petrov',
        middleName: null,
        position: 'Manager',
      },
      equipmentExtension: null,
      extensionCode: null,
      factDate: null,
      id: 1,
      note: null,
      originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibles: [],
      source: EventSource.MANUAL,
      status: EventStatus.CREATED,
      title: 'Standalone event',
      version: 1,
      ...overrides,
    };
  }

  function createService() {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new EventsQueryService(prisma as never);

    return { prisma, service };
  }

  it('passes safe list query to Prisma', async () => {
    const { prisma, service } = createService();
    const where = {
      extensionCode: null,
      plannedDate: {
        gte: new Date('2026-08-01T00:00:00.000Z'),
      },
    };

    await service.findAll({
      limit: 25,
      offset: 10,
      where,
    });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { factDate: { sort: 'desc', nulls: 'last' } },
          { plannedDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: 10,
        take: 25,
        where,
      }),
    );
  });

  it('does not load checklists when event list is empty', async () => {
    const { prisma, service } = createService();
    prisma.event.findMany.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual([]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns standalone and equipment events through generic presenter', async () => {
    const { prisma, service } = createService();
    prisma.event.findMany.mockResolvedValue([
      {
        equipmentExtension: null,
        extensionCode: null,
        factDate: null,
        id: 1,
        note: null,
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Standalone event',
        version: 1,
      },
      {
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
        extensionCode: EventExtensionCode.EQUIPMENT,
        factDate: null,
        id: 2,
        note: 'note',
        plannedDate: new Date('2026-08-02T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.PLANNED,
        status: EventStatus.IN_PROGRESS,
        title: 'Equipment event',
        version: 2,
      },
    ]);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({
      extension: null,
      extensionCode: null,
      id: 1,
      title: 'Standalone event',
    });
    expect(result[1]).toMatchObject({
      extensionCode: EventExtensionCode.EQUIPMENT,
      id: 2,
      title: 'Equipment event',
    });
    expect(result[1]?.extension).toMatchObject({
      code: EventExtensionCode.EQUIPMENT,
      equipment: {
        visibleId: 5001,
      },
    });
  });

  it('throws when event detail is not found', async () => {
    const { prisma, service } = createService();
    prisma.event.findFirst.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
        message: 'Событие не найдено.',
      },
    });
  });

  it('returns event detail with grouped checklist records', async () => {
    const { prisma, service } = createService();
    prisma.event.findFirst.mockResolvedValue(createStandaloneEvent());
    prisma.$queryRaw.mockResolvedValue([
      {
        assignedUser: {
          fullName: 'Ivan Petrov',
          id: 'user-1',
          position: 'Engineer',
        },
        assignedUserId: 'user-1',
        checklistTemplateId: 11,
        eventId: 1,
        id: 100,
        progress: {
          answered: 1,
          requiredAnswered: 1,
          requiredTotal: 2,
          total: 3,
        },
        sortOrder: 1,
        status: EventStatus.CREATED,
        templateName: 'Daily checklist',
      },
    ]);

    await expect(service.findOne(1)).resolves.toMatchObject({
      checklists: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
          id: 100,
          progress: {
            answered: 1,
            requiredAnswered: 1,
            requiredTotal: 2,
            total: 3,
          },
          status: EventStatus.CREATED,
          templateName: 'Daily checklist',
        },
      ],
      createdBy: {
        fullName: 'Petrov Ivan',
        id: 5,
      },
      id: 1,
      title: 'Standalone event',
    });
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('loads responsible user options', async () => {
    const { prisma, service } = createService();
    prisma.user.findMany.mockResolvedValue([
      {
        employeeUser: null,
        id: 'user-without-employee',
        role: 'operator',
      },
      {
        employeeUser: {
          employee: {
            firstName: 'Ivan',
            lastName: 'Petrov',
            middleName: 'Sergeevich',
            position: 'Engineer',
          },
        },
        id: 'user-1',
        role: 'engineer',
      },
    ]);

    await expect(service.findResponsibleUsers()).resolves.toEqual({
      users: [
        {
          fullName: 'Petrov Ivan Sergeevich',
          position: 'Engineer',
          role: 'engineer',
          userId: 'user-1',
        },
      ],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeUser: {
            is: {
              employee: {
                isActive: true,
              },
            },
          },
          OR: [{ banned: false }, { banned: null }],
        },
      }),
    );
  });
});
