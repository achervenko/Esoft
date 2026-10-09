import { Prisma, type PpeIssue } from '@prisma/client';
import {
  date,
  norm,
  issue,
  policy,
  run,
} from './ppe-norm-transition.spec-fixtures';

describe('PPE monthly norm transitions', () => {
  it('credits the five pairs already issued this month against the new ten', () => {
    const { state } = run(
      'HARD',
      [issue(1, '2026-10-01', 5), issue(1, '2026-09-01', 5)],
      'MONTHLY',
      60,
      120,
    );
    expect(state.available?.quantity).toBe(5);
    expect(state.duePortions).toBe(1);
    expect(state.dueUnissued).toBe(1);
    expect(state.nextFuture?.quantity).toBe(10);
    expect(state.nextFuture?.scheduledAt).toEqual(date('2026-11-01'));
  });
  it('issues the full current month if nothing was issued, without retroactive debt', () => {
    expect(
      run('HARD', [issue(1, '2026-01-01', 5)], 'MONTHLY', 60, 120).state
        .available?.quantity,
    ).toBe(10);
  });
  it('credits current-month issues across more than one previous revision', () => {
    const a = norm(1, 'SOFT', '2026-01-01', 60, 'MONTHLY');
    const b = norm(2, 'HARD', '2026-10-03', 120, 'MONTHLY', 1);
    const c = norm(3, 'HARD', '2026-10-07', 144, 'MONTHLY', 2);
    const { state } = policy.evaluate(
      new Map([
        [1, a],
        [2, b],
        [3, c],
      ]),
      c,
      c.items[0],
      date('2026-10-07'),
      [issue(1, '2026-10-01', 5), issue(2, '2026-10-03', 5)],
    );
    expect(state.available?.quantity).toBe(2);
  });
  it('does not deduct excess current-month issuance from later months', () => {
    const { state } = run(
      'HARD',
      [issue(1, '2026-10-01', 20)],
      'MONTHLY',
      120,
      60,
    );
    expect(state.available).toBeNull();
    expect(state.nextFuture?.quantity).toBe(5);
  });
  it('starts soft monthly transition after the old covered month ends', () => {
    const { state } = run(
      'SOFT',
      [issue(1, '2026-10-01', 5)],
      'MONTHLY',
      60,
      120,
    );
    expect(state.available).toBeNull();
    expect(state.nextFuture).toEqual({
      index: 0,
      scheduledAt: date('2026-11-01'),
      quantity: 10,
    });
  });
  it('does not open another monthly need after topping up, and cancellation reopens it', () => {
    const original = issue(1, '2026-10-01', 5),
      topup = issue(2, '2026-10-07', 5);
    expect(
      run('HARD', [original, topup], 'MONTHLY', 60, 120).state.available,
    ).toBeNull();
    expect(
      run(
        'HARD',
        [original, { ...topup, status: 'CANCELLED' }],
        'MONTHLY',
        60,
        120,
      ).state.available?.quantity,
    ).toBe(5);
  });
  it('permits a second top-up after cancellation of the old credited issue', () => {
    const cancelled = issue(1, '2026-10-01', 5, { status: 'CANCELLED' });
    const topup = issue(2, '2026-10-07', 5);
    const { state } = run('HARD', [cancelled, topup], 'MONTHLY', 60, 120);
    expect(state.available).toEqual({
      index: 1,
      scheduledAt: date('2026-10-07'),
      quantity: 5,
    });
  });
  it('keeps normal unissued needs arising after activation', () => {
    const { state } = run('HARD', [], 'MONTHLY', 60, 120, '2026-12-01');
    expect(state.dueUnissued).toBe(3);
    expect(state.available?.quantity).toBe(10);
    expect(state.available?.scheduledAt).toEqual(date('2026-10-07'));
  });
  it('closes the scheduled month when its volume is issued late', () => {
    const late = issue(2, '2026-11-05', 10, {
      scheduledAt: date('2026-10-07'),
    });
    const { state } = run('HARD', [late], 'MONTHLY', 60, 120, '2026-11-05');
    expect(state.dueUnissued).toBe(1);
    expect(state.available?.scheduledAt).toEqual(date('2026-11-01'));
    expect(state.available?.quantity).toBe(10);
  });
  it('distributes fractional monthly volumes without rounding away annual quantity', () => {
    const a = norm(1, 'SOFT', '2026-01-01', 1, 'MONTHLY');
    a.items[0].ppeUnitSnapshot = 'мл';
    const context = new Map([[1, a]]);
    const history: PpeIssue[] = [];
    let total = new Prisma.Decimal(0);
    for (let month = 1; month <= 12; month++) {
      const on = `2026-${String(month).padStart(2, '0')}-01`;
      const available = policy.evaluate(
        context,
        a,
        a.items[0],
        date(on),
        history,
      ).state.available!;
      total = total.add(available.quantity);
      history.push(issue(1, on, available.quantity, { id: month }));
    }
    expect(total.toNumber()).toBe(1);
  });
  it('distributes indivisible pieces and pairs as whole units with the exact period total', () => {
    for (const unit of ['шт', 'пары']) {
      const a = norm(1, 'SOFT', '2026-01-01', 5, 'MONTHLY');
      a.items[0].ppeUnitSnapshot = unit;
      const history: PpeIssue[] = [];
      const context = new Map([[1, a]]);
      for (let month = 1; month <= 12; month++) {
        const on = `2026-${String(month).padStart(2, '0')}-01`;
        const available = policy.evaluate(
          context,
          a,
          a.items[0],
          date(on),
          history,
        ).state.available;
        if (!available) continue;
        expect(Number.isInteger(available.quantity)).toBe(true);
        history.push(
          issue(1, on, available.quantity, {
            id: month,
            scheduledAt: available.scheduledAt,
          }),
        );
      }
      expect(
        history.reduce((sum, entry) => sum + entry.quantity.toNumber(), 0),
      ).toBe(5);
    }
  });
});
