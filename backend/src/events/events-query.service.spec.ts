import {
  EquipmentMaintenanceExecutionType,
  EventExtensionCode,
  EventSource,
  EventStatus,
} from '@prisma/client';
import { EventsQueryService } from './events-query.service';

describe('EventsQueryService', () => {
  function createService() {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      event: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
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
        skip: 10,
        take: 25,
        where,
      }),
    );
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
});
