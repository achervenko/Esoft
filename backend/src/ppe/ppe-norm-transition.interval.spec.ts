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
  it('hard transition opens only one current need, never missed historical portions', () => {
    const { state } = run('HARD', [issue()]);
    expect(state.available).toEqual({
      index: 0,
      scheduledAt: date('2026-10-07'),
      quantity: 1,
    });
    expect(state.dueUnissued).toBe(1);
  });
  it('starts the next wear period from actual late issuance', () => {
    const { state } = run(
      'HARD',
      [issue(), issue(2, '2026-10-20')],
      'INTERVAL',
      1,
      2,
      '2026-10-21',
    );
    expect(state.available).toBeNull();
    expect(state.nextFuture?.scheduledAt).toEqual(date('2027-04-20'));
  });
  it('ignores extra, cancelled and future issues', () => {
    const { state } = run('HARD', [
      issue(),
      issue(1, '2026-10-06', 1, { issueType: 'EXTRA' }),
      issue(1, '2026-10-06', 1, { status: 'CANCELLED' }),
      issue(2, '2026-11-01'),
    ]);
    expect(state.available?.quantity).toBe(1);
  });
  it('does not postpone new items with unrelated history', () => {
    const { state } = run('SOFT', [issue(99)]);
    expect(state.available?.scheduledAt).toEqual(date('2026-10-07'));
  });
  it('preserves an outstanding soft deadline across several unissued revisions', () => {
    const a = norm();
    const b = norm(2, 'SOFT', '2026-06-01', 2, 'INTERVAL', 1);
    const c = norm(3, 'SOFT', '2026-10-07', 3, 'INTERVAL', 2);
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
