import {
  date,
  norm,
  issue,
  policy,
  run,
} from './ppe-norm-transition.spec-fixtures';

describe('PPE interval norm transitions', () => {
  it('soft transition preserves the old wear expiry', () => {
    const { state } = run('SOFT', [issue()]);
    expect(state.available).toBeNull();
    expect(state.nextFuture?.scheduledAt).toEqual(date('2027-01-01'));
  });
  it('hard transition ignores recent ancestor issuance for its deadline and early window', () => {
    const { state } = run('HARD', [issue(1, '2026-10-06')]);
    expect(state).toMatchObject({
      plannedDate: date('2026-10-07'),
      availableFrom: date('2026-09-07'),
      obligationStatus: 'DUE',
      available: { quantity: 2 },
    });
  });
  it('hard transition advances only from its own issuance even when ancestor history is later', () => {
    const { state } = run(
      'HARD',
      [issue(2, '2026-10-07'), issue(1, '2026-10-08')],
      1,
      2,
      '2026-10-09',
    );
    expect(state.plannedDate).toEqual(date('2027-10-07'));
    expect(state.available).toBeNull();
  });
  it('hard transition uses the new interval without dividing quantity', () => {
    const old = norm();
    const next = norm(2, 'HARD', '2026-10-07', 2, 1);
    next.items[0].periodCount = 6;
    next.items[0].periodUnit = 'MONTH';
    const { state } = policy.evaluate(
      new Map([
        [1, old],
        [2, next],
      ]),
      next,
      next.items[0],
      date('2026-10-07'),
      [issue()],
    );
    expect(state.available).toEqual({
      scheduledAt: date('2026-10-07'),
      quantity: 2,
    });
    expect(state.available?.quantity).toBe(2);
  });
  it('starts the next wear period from actual late issuance', () => {
    const { state } = run(
      'HARD',
      [issue(), issue(2, '2026-10-20')],
      1,
      2,
      '2026-10-21',
    );
    expect(state.available).toBeNull();
    expect(state.nextFuture?.scheduledAt).toEqual(date('2027-10-20'));
  });
  it('ignores extra, cancelled and future issues', () => {
    const { state } = run('HARD', [
      issue(),
      issue(1, '2026-10-06', 1, { issueType: 'EXTRA' }),
      issue(1, '2026-10-06', 1, { status: 'CANCELLED' }),
      issue(2, '2026-11-01'),
    ]);
    expect(state.plannedDate).toEqual(date('2026-10-07'));
    expect(state.available?.quantity).toBe(2);
  });
  it('does not postpone new items with unrelated history', () => {
    const { state } = run('SOFT', [issue(99)]);
    expect(state.available?.scheduledAt).toEqual(date('2026-10-07'));
  });
  it('preserves an outstanding soft deadline across several unissued revisions', () => {
    const a = norm();
    const b = norm(2, 'SOFT', '2026-06-01', 2, 1);
    const c = norm(3, 'SOFT', '2026-10-07', 3, 2);
    const { state } = policy.evaluate(
      new Map([
        [1, a],
        [2, b],
        [3, c],
      ]),
      c,
      c.items[0],
      date('2026-10-07'),
      [issue()],
    );
    expect(state.nextFuture?.scheduledAt).toEqual(date('2027-01-01'));
  });
});
