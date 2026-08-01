import type { PrismaService } from '../prisma/prisma.service';
import { EQUIPMENT_PROGRESS_TARGET_COUNT } from './equipment-progress-dashboard.constants';
import { EquipmentProgressDashboardService } from './equipment-progress-dashboard.service';

describe('EquipmentProgressDashboardService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-01T09:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts one created equipment per audit entity id per day', async () => {
    const prisma = createPrismaMock({
      auditRows: [
        { createdAt: new Date('2026-07-30T08:00:00.000Z'), entityId: 1 },
        { createdAt: new Date('2026-07-30T08:01:00.000Z'), entityId: 1 },
        { createdAt: new Date('2026-07-30T09:00:00.000Z'), entityId: 2 },
      ],
      equipment: [createCompleteEquipment({ visibleId: 1 })],
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.recentCreatedCount).toBe(2);
    expect(
      dashboard.recentDailyCounts.find((item) => item.date === '2026-07-30'),
    ).toEqual({ count: 2, date: '2026-07-30' });
  });

  it('returns readable missing fields for incomplete equipment', async () => {
    const prisma = createPrismaMock({
      auditRows: [],
      equipment: [
        createCompleteEquipment({
          countryId: null,
          operationText: null,
          serialNumber: null,
          visibleId: 7,
        }),
      ],
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.completedCardsCount).toBe(0);
    expect(dashboard.incompleteCardsCount).toBe(1);
    expect(dashboard.incompleteEquipment).toEqual([
      {
        missingFields: ['Серийный номер', 'Страна', 'Эксплуатация'],
        name: 'Станок',
        visibleId: 7,
      },
    ]);
  });

  it('calculates overall progress from filled controlled fields and target count', async () => {
    const prisma = createPrismaMock({
      auditRows: [],
      equipment: Array.from({ length: 1 }, (_, index) =>
        createCompleteEquipment({ visibleId: index + 1 }),
      ),
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.progressPercent).toBe(
      Math.round((1 / EQUIPMENT_PROGRESS_TARGET_COUNT) * 100),
    );
  });

  it('uses raw average creation pace for forecast calculations', async () => {
    const prisma = createPrismaMock({
      auditRows: [
        { createdAt: new Date('2026-07-30T08:00:00.000Z'), entityId: 1 },
      ],
      equipment: [createCompleteEquipment({ visibleId: 1 })],
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.averageCreatedPerDay).toBe(0.1);
    expect(dashboard.estimatedDaysRemaining).toBe(
      Math.ceil((EQUIPMENT_PROGRESS_TARGET_COUNT - 1) / (1 / 7)),
    );
    expect(dashboard.estimatedCompletionDate).toBe('2026-08-15');
  });

  it('groups audit rows by business day boundaries', async () => {
    const prisma = createPrismaMock({
      auditRows: [
        { createdAt: new Date('2026-07-30T20:59:59.000Z'), entityId: 1 },
        { createdAt: new Date('2026-07-30T21:00:00.000Z'), entityId: 2 },
      ],
      equipment: [
        createCompleteEquipment({ visibleId: 1 }),
        createCompleteEquipment({ visibleId: 2 }),
      ],
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(
      dashboard.recentDailyCounts.find((item) => item.date === '2026-07-30'),
    ).toEqual({ count: 1, date: '2026-07-30' });
    expect(
      dashboard.recentDailyCounts.find((item) => item.date === '2026-07-31'),
    ).toEqual({ count: 1, date: '2026-07-31' });
  });

  it('does not build a forecast when creation pace is zero and target is not reached', async () => {
    const prisma = createPrismaMock({
      auditRows: [],
      equipment: [],
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.averageCreatedPerDay).toBe(0);
    expect(dashboard.estimatedDaysRemaining).toBeNull();
    expect(dashboard.estimatedCompletionDate).toBeNull();
  });

  it('returns completed forecast when target count is reached', async () => {
    const prisma = createPrismaMock({
      auditRows: [],
      equipment: Array.from(
        { length: EQUIPMENT_PROGRESS_TARGET_COUNT },
        (_, index) => createCompleteEquipment({ visibleId: index + 1 }),
      ),
    });
    const service = new EquipmentProgressDashboardService(
      prisma as unknown as PrismaService,
    );

    const dashboard = await service.getProgress();

    expect(dashboard.remainingCount).toBe(0);
    expect(dashboard.estimatedDaysRemaining).toBe(0);
    expect(dashboard.estimatedCompletionDate).toBe('2026-08-01');
  });
});

function createPrismaMock(params: {
  auditRows: Array<{ createdAt: Date; entityId: number | null }>;
  equipment: unknown[];
}) {
  return {
    auditLog: {
      findMany: jest.fn().mockResolvedValue(params.auditRows),
    },
    equipment: {
      findMany: jest.fn().mockResolvedValue(params.equipment),
    },
  };
}

function createCompleteEquipment(
  overrides: Partial<{
    commissioningDate: Date | null;
    countryId: number | null;
    inventoryNumber: string;
    issueDate: Date;
    manufactureYear: number | null;
    model: { manufacturerId: number | null };
    modelId: number;
    name: string;
    operationText: string | null;
    responsibleEmployeeId: number;
    sectionId: number;
    serialNumber: string | null;
    specifications: string | null;
    status: string;
    visibleId: number;
  }> = {},
) {
  return {
    commissioningDate: new Date('2021-03-01T00:00:00.000Z'),
    countryId: 1,
    inventoryNumber: 'INV-1',
    issueDate: new Date('2021-03-02T00:00:00.000Z'),
    manufactureYear: 2020,
    model: { manufacturerId: 1 },
    modelId: 1,
    name: 'Станок',
    operationText: 'Эксплуатация',
    responsibleEmployeeId: 1,
    sectionId: 1,
    serialNumber: 'SN-1',
    specifications: 'Характеристики',
    status: 'ACTIVE',
    visibleId: 1,
    ...overrides,
  };
}
