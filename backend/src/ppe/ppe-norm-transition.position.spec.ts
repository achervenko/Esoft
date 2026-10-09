import type { PpeIssue } from '@prisma/client';
import { date, norm, issue, policy } from './ppe-norm-transition.spec-fixtures';

describe('entitlement after position assignment', () => {
  const assigned = date('2026-10-07');
  function transfer(
    calculationMode = 'INTERVAL',
    oldQuantity = 1,
    quantity = 2,
  ) {
    const old = {
      ...norm(10, 'SOFT', '2026-01-01', oldQuantity, calculationMode),
      positionId: 2,
    };
    const current = norm(20, 'HARD', '2026-01-01', quantity, calculationMode);
    const context = new Map([
      [old.id, old],
      [current.id, current],
    ]);
    return {
      old,
      current,
      evaluate: (history: PpeIssue[], on = assigned) =>
        policy.evaluate(
          context,
          current,
          current.items[0],
          on,
          history,
          assigned,
        ),
    };
  }
  it('preserves old wear expiry even if the new position requires more frequent replacement', () => {
    const f = transfer();
    const previous = issue(10, '2026-06-01', 1, { positionId: 2 });
    const result = f.evaluate([previous]);
    expect(result.state.available).toBeNull();
    expect(result.state.nextFuture?.scheduledAt).toEqual(date('2027-06-01'));
    expect(
      f.evaluate([previous], date('2027-06-01')).state.available?.quantity,
    ).toBe(1);
    const latest = issue(20, '2027-06-01', 1, { positionId: 1 });
    expect(
      f.evaluate([previous, latest], date('2027-06-01')).state.nextFuture
        ?.scheduledAt,
    ).toEqual(date('2027-12-01'));
  });
  it('makes missing items due on assignment without importing earlier debt', () => {
    const f = transfer('MONTHLY', 60, 120);
    const result = f.evaluate([]);
    expect(result.state.dueUnissued).toBe(1);
    expect(result.state.available).toMatchObject({
      scheduledAt: assigned,
      quantity: 10,
    });
  });
  it('keeps retained wear through a later soft revision and recalculates it for a hard revision', () => {
    const f = transfer();
    const next = norm(30, 'SOFT', '2026-11-01', 4, 'INTERVAL', f.current.id);
    const context = new Map([
      [f.old.id, f.old],
      [f.current.id, f.current],
      [next.id, next],
    ]);
    const old = issue(10, '2026-06-01', 1, { positionId: 2 });
    const evaluate = () =>
      policy.evaluate(
        context,
        next,
        next.items[0],
        date('2026-11-01'),
        [old],
        assigned,
      ).state;
    expect(evaluate().available).toBeNull();
    expect(evaluate().nextFuture?.scheduledAt).toEqual(date('2027-06-01'));
    next.transitionMode = 'HARD';
    expect(evaluate().available).not.toBeNull();
  });
  it('credits old monthly issues and tops up only the current month', () => {
    const f = transfer('MONTHLY', 60, 120);
    const old = issue(10, '2026-10-01', 5, { positionId: 2 });
    expect(f.evaluate([old]).state.available?.quantity).toBe(5);
    const topup = issue(20, '2026-10-07', 5, { positionId: 1 });
    expect(f.evaluate([old, topup]).state.available).toBeNull();
    expect(
      f.evaluate([{ ...old, status: 'CANCELLED' }, topup]).state.available,
    ).toMatchObject({ quantity: 5, index: 1 });
  });
  it('does not count cancelled issues, extras or different catalog items', () => {
    const f = transfer();
    expect(
      f.evaluate([
        issue(10, '2026-06-01', 1, { positionId: 2, status: 'CANCELLED' }),
      ]).state.available,
    ).not.toBeNull();
    expect(
      f.evaluate([
        issue(10, '2026-06-01', 1, { positionId: 2, issueType: 'EXTRA' }),
      ]).state.available,
    ).not.toBeNull();
    f.old.items[0].ppeItemId = 99;
    expect(
      f.evaluate([issue(10, '2026-06-01', 1, { positionId: 2 })]).state
        .available,
    ).not.toBeNull();
  });
});
