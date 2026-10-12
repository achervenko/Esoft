import { type PpeIssue } from '@prisma/client';
import { date, norm, issue, policy } from './ppe-norm-transition.spec-fixtures';

function setup(
  periodCount = 1,
  periodUnit: 'DAY' | 'MONTH' | 'YEAR' = 'YEAR',
  quantity = 2,
  from = '2026-10-10',
) {
  const current = norm(1, 'SOFT', from, quantity);
  Object.assign(current.items[0], { periodCount, periodUnit });
  const evaluate = (on: string, history: PpeIssue[] = []) =>
    policy.evaluate(
      new Map([[1, current]]),
      current,
      current.items[0],
      date(on),
      history,
    ).state;
  return { current, evaluate };
}
function closed(planned: string, actual: string, id = 1) {
  return issue(1, actual, 2, { id, scheduledAt: date(planned) });
}
describe('interval obligations', () => {
  it('opens the first future obligation thirty days before the norm starts', () => {
    const { evaluate } = setup(1, 'YEAR', 2, '2026-11-01');
    expect(evaluate('2026-10-01').available).toBeNull();
    expect(evaluate('2026-10-02')).toMatchObject({
      plannedDate: date('2026-11-01'),
      availableFrom: date('2026-10-02'),
      obligationStatus: 'EARLY',
      available: { quantity: 2 },
    });
  });
  it.each([
    ['шт', 2],
    ['пары', 2],
    ['мл', 0.125],
    ['л', 2.5],
  ])('never divides %s quantity %s', (unit, quantity) => {
    const { current, evaluate } = setup(1, 'YEAR', Number(quantity));
    current.items[0].ppeUnitSnapshot = String(unit);
    expect(evaluate('2026-10-10').available?.quantity).toBe(quantity);
  });
  it('advances six calendar months and opens thirty days early', () => {
    const { evaluate } = setup(6, 'MONTH', 1, '2026-04-01');
    const history = [closed('2026-04-01', '2026-04-01')];
    expect(evaluate('2026-08-31', history)).toMatchObject({
      available: null,
      plannedDate: date('2026-10-01'),
      availableFrom: date('2026-09-01'),
      obligationStatus: 'NOT_AVAILABLE',
    });
    expect(evaluate('2026-09-01', history).obligationStatus).toBe('EARLY');
    expect(evaluate('2026-10-01', history)).toMatchObject({
      obligationStatus: 'DUE',
      overdue: 0,
    });
    expect(evaluate('2026-10-02', history)).toMatchObject({
      obligationStatus: 'OVERDUE',
      overdue: 1,
    });
  });
  it('opens a twenty-day period twenty days early but not before the previous issue', () => {
    const { evaluate } = setup(20, 'DAY', 1, '2026-10-01');
    const state = evaluate('2026-10-01', [closed('2026-10-01', '2026-10-01')]);
    expect(state).toMatchObject({
      plannedDate: date('2026-10-21'),
      availableFrom: date('2026-10-01'),
      obligationStatus: 'EARLY',
    });
  });
  it('permits two consecutive weekly obligations on one day, not a third', () => {
    const { evaluate } = setup(7, 'DAY', 1);
    const first = closed('2026-10-10', '2026-10-10', 1);
    const second = closed('2026-10-17', '2026-10-10', 2);
    expect(evaluate('2026-10-10').available?.scheduledAt).toEqual(
      date('2026-10-10'),
    );
    expect(evaluate('2026-10-10', [first]).available?.scheduledAt).toEqual(
      date('2026-10-17'),
    );
    expect(evaluate('2026-10-10', [first, second])).toMatchObject({
      available: null,
      plannedDate: date('2026-10-24'),
      availableFrom: date('2026-10-17'),
    });
  });
  it('early issuance closes the obligation without moving the next planned date backwards', () => {
    const { evaluate } = setup(1, 'YEAR', 1, '2025-10-10');
    const history = [
      closed('2025-10-10', '2025-10-10'),
      closed('2026-10-10', '2026-10-01', 2),
    ];
    expect(evaluate('2026-10-01', history)).toMatchObject({
      plannedDate: date('2027-10-10'),
      available: null,
    });
  });
  it('late issuance advances the next date from actual issuance', () => {
    const { evaluate } = setup(6, 'MONTH');
    expect(
      evaluate('2026-10-15', [closed('2026-10-10', '2026-10-15')]).plannedDate,
    ).toEqual(date('2027-04-15'));
  });
  it.each([
    ['2026-01-31', 1, 'MONTH', '2026-02-28'],
    ['2024-02-29', 1, 'YEAR', '2025-02-28'],
  ])('clamps calendar period %s', (from, count, unit, expected) => {
    const { evaluate } = setup(
      Number(count),
      unit as 'MONTH' | 'YEAR',
      1,
      String(from),
    );
    expect(
      evaluate(String(from), [closed(String(from), String(from))]).plannedDate,
    ).toEqual(date(String(expected)));
  });
  it('extras do not close an obligation or move its deadline', () => {
    const { evaluate } = setup();
    expect(
      evaluate('2026-10-10', [
        { ...closed('2026-10-10', '2026-10-10'), issueType: 'EXTRA' },
      ]).available?.scheduledAt,
    ).toEqual(date('2026-10-10'));
  });
  it('reopens a cancelled obligation, even if a later obligation remains closed', () => {
    const { evaluate } = setup(7, 'DAY');
    const cancelled = {
      ...closed('2026-10-10', '2026-10-10'),
      status: 'CANCELLED' as const,
    };
    const later = closed('2026-10-17', '2026-10-10', 2);
    expect(evaluate('2026-10-11', [cancelled, later])).toMatchObject({
      plannedDate: date('2026-10-10'),
      obligationStatus: 'OVERDUE',
    });
    expect(
      evaluate('2026-10-11', [
        cancelled,
        later,
        closed('2026-10-10', '2026-10-11', 3),
      ]).plannedDate,
    ).toEqual(date('2026-10-24'));
  });
  it('does not create dates beyond the API date range', () => {
    const { evaluate } = setup(2147483647, 'DAY');
    expect(
      evaluate('2026-10-10', [closed('2026-10-10', '2026-10-10')]),
    ).toMatchObject({
      plannedDate: null,
      available: null,
      obligationStatus: 'FINISHED',
    });
  });
});
