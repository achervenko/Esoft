import type { PrismaService } from '../prisma/prisma.service';
import { EQUIPMENT_PROGRESS_TARGET_COUNT } from './equipment-progress-dashboard.constants';
import { EquipmentProgressDashboardService } from './equipment-progress-dashboard.service';
import type { EquipmentProgressSummary } from './equipment-progress-query';

describe('EquipmentProgressDashboardService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-01T09:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  const create = (overrides: Partial<EquipmentProgressSummary> = {}) => {
    const query = jest.fn().mockResolvedValue([
      {
        createdCount: 0,
        incompleteCardsCount: 0,
        filledFieldsCount: 0,
        incompleteEquipment: [],
        recentDailyCounts: [],
        ...overrides,
      },
    ]);
    return {
      query,
      service: new EquipmentProgressDashboardService({
        $queryRaw: query,
      } as unknown as PrismaService),
    };
  };
  it('does not forecast without a creation pace and fills missing days with zeroes', async () => {
    const { service } = create();
    const result = await service.getProgress();
    expect(result.estimatedCompletionDate).toBeNull();
    expect(result.estimatedDaysRemaining).toBeNull();
    expect(result.recentDailyCounts).toHaveLength(7);
    expect(result.recentDailyCounts.every((day) => day.count === 0)).toBe(true);
  });
  it('retains the controlled-field progress and readable incomplete examples', async () => {
    const incompleteEquipment = [
      {
        visibleId: 7,
        name: 'Станок',
        missingFields: ['Серийный номер', 'Страна', 'Эксплуатация'],
      },
    ];
    const { service } = create({
      createdCount: 1,
      incompleteCardsCount: 1,
      filledFieldsCount: 11,
      incompleteEquipment,
    });
    const result = await service.getProgress();
    expect(result.completedCardsCount).toBe(0);
    expect(result.incompleteEquipment).toEqual(incompleteEquipment);
    expect(result.progressPercent).toBe(
      Math.round((11 / (14 * EQUIPMENT_PROGRESS_TARGET_COUNT)) * 100),
    );
  });
  it('uses the unrounded daily pace for forecasts', async () => {
    const { service } = create({
      createdCount: 1,
      filledFieldsCount: 14,
      recentDailyCounts: [{ date: '2026-07-30', count: 1 }],
    });
    const result = await service.getProgress();
    expect(result.averageCreatedPerDay).toBe(0.1);
    expect(result.recentCreatedCount).toBe(1);
    expect(result.estimatedDaysRemaining).toBe(
      Math.ceil((EQUIPMENT_PROGRESS_TARGET_COUNT - 1) / (1 / 7)),
    );
    expect(result.estimatedCompletionDate).toBe('2026-08-15');
  });
  it('returns a completed forecast when the target is reached', async () => {
    const { service } = create({
      createdCount: EQUIPMENT_PROGRESS_TARGET_COUNT,
      filledFieldsCount: 14 * EQUIPMENT_PROGRESS_TARGET_COUNT,
    });
    const result = await service.getProgress();
    expect(result.remainingCount).toBe(0);
    expect(result.estimatedDaysRemaining).toBe(0);
    expect(result.estimatedCompletionDate).toBe('2026-08-01');
  });
});
