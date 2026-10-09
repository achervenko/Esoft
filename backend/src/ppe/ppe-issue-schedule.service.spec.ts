import { Prisma } from '@prisma/client';
import { PpeIssueScheduleService } from './ppe-issue-schedule.service';

const schedule = new PpeIssueScheduleService();
const date = (value: string) => new Date(`${value}T00:00:00Z`);
function build(
  on: string,
  quantity = 2,
  fulfilled: number[] = [],
  from = '2026-01-06',
  periodCount = 1,
  periodUnit: 'YEAR' | 'MONTH' = 'YEAR',
  to: string | null = null,
) {
  return schedule.build(
    { effectiveFrom: date(from), effectiveTo: to ? date(to) : null },
    {
      quantity: new Prisma.Decimal(quantity),
      periodCount,
      periodUnit,
      ppeUnitSnapshot: 'шт',
    },
    date(on),
    new Set(fulfilled),
  );
}

describe('PPE issue schedule', () => {
  it.each([300, 300.5])(
    'issues %s ml as a single full portion per period',
    (quantity) => {
      const state = schedule.build(
        { effectiveFrom: date('2026-01-01'), effectiveTo: null },
        {
          quantity: new Prisma.Decimal(quantity),
          periodCount: 1,
          periodUnit: 'YEAR',
          ppeUnitSnapshot: 'мл',
        },
        date('2026-01-01'),
      );
      expect(state.totalPortions).toBe(1);
      expect(state.available?.quantity).toBe(quantity);
      expect(state.nextFuture?.scheduledAt).toEqual(date('2027-01-01'));
    },
  );
  it('splits two units per year into January and July without shifting after late issue', () => {
    expect(build('2026-01-08').available).toEqual({
      index: 0,
      quantity: 1,
      scheduledAt: date('2026-01-06'),
    });
    const state = build('2026-01-08', 2, [0]);
    expect(state.available).toBeNull();
    expect(state.nextFuture?.scheduledAt).toEqual(date('2026-07-06'));
    expect(build('2026-07-06', 2, [0]).available?.scheduledAt).toEqual(
      date('2026-07-06'),
    );
  });
  it('reports overdue unissued portions and opens a cancelled portion', () => {
    const state = build('2026-07-08');
    expect(state.dueUnissued).toBe(2);
    expect(state.overdue).toBe(2);
    expect(build('2026-07-08', 2, [0]).available?.index).toBe(1);
    expect(build('2026-07-08', 2, []).available?.index).toBe(0);
  });
  it('handles fractional quantities as one complete portion', () => {
    for (const quantity of [0.001, 0.5, 1.125, 2.5, 12.125]) {
      const state = build('2026-01-06', quantity);
      expect(state.totalPortions).toBe(1);
      expect(state.available?.quantity).toBe(quantity);
    }
  });
  it('starts the next cycle without carrying missed portions from previous years', () => {
    const state = build('2028-01-08');
    expect(state.cycleFrom).toEqual(date('2028-01-06'));
    expect(state.dueUnissued).toBe(1);
    expect(state.available?.scheduledAt).toEqual(date('2028-01-06'));
  });
  it('uses calendar months when the period divides evenly', () => {
    const state = build('2026-02-06', 12, [0]);
    expect(state.available?.scheduledAt).toEqual(date('2026-02-06'));
    expect(state.nextFuture?.scheduledAt).toEqual(date('2026-03-06'));
  });
  it('distributes irregular counts evenly over days of the period', () => {
    expect(build('2026-03-20', 5, [0]).available?.scheduledAt).toEqual(
      date('2026-03-20'),
    );
    expect(
      build('2026-01-21', 2, [0], '2026-01-06', 1, 'MONTH').available
        ?.scheduledAt,
    ).toEqual(date('2026-01-21'));
  });
  it('clamps month ends against the original calendar anchor', () => {
    const february = build('2026-02-28', 1, [], '2026-01-31', 1, 'MONTH');
    expect(february.available?.scheduledAt).toEqual(date('2026-02-28'));
    expect(february.nextFuture?.scheduledAt).toEqual(date('2026-03-31'));
    expect(
      build('2028-02-29', 1, [], '2028-01-31', 1, 'MONTH').available
        ?.scheduledAt,
    ).toEqual(date('2028-02-29'));
  });
  it('preserves leap-day anchors across year cycles', () => {
    expect(
      build('2025-02-28', 1, [], '2024-02-29').available?.scheduledAt,
    ).toEqual(date('2025-02-28'));
    expect(
      build('2028-02-29', 1, [], '2024-02-29').available?.scheduledAt,
    ).toEqual(date('2028-02-29'));
  });
  it('does not propose portions after the norm ends', () => {
    const state = build(
      '2026-01-08',
      2,
      [0],
      '2026-01-06',
      1,
      'YEAR',
      '2026-05-01',
    );
    expect(state.totalPortions).toBe(1);
    expect(state.nextFuture).toBeNull();
  });
  it('distinguishes same-day portions by index without allocating a huge array', () => {
    const state = build('2026-01-06', 999_999_999, [0]);
    expect(state.totalPortions).toBe(999_999_999);
    expect(state.available).toEqual({
      index: 1,
      quantity: 1,
      scheduledAt: date('2026-01-06'),
    });
    expect(state.dueUnissued).toBeGreaterThan(1);
  });
  it('supports very long periods and emits no dates beyond the API year range', () => {
    const state = build('2026-01-06', 1, [], '2026-01-06', 2_147_483_647);
    expect(state.available?.scheduledAt).toEqual(date('2026-01-06'));
    expect(state.cycleTo).toBeNull();
    expect(state.nextFuture).toBeNull();
  });
});
