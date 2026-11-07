import { latestOrdersRun } from './orders.constants';
import { ordersSyncDue } from './orders-sync.service';
it.each([
  ['2026-11-06T00:00:00Z', '2026-11-06T00:00:00.000Z'],
  ['2026-11-05T23:59:59Z', '2026-11-05T00:00:00.000Z'],
  ['2027-01-01T23:00:00Z', '2027-01-01T00:00:00.000Z'],
])('uses 03:00 Moscow at %s', (now, expected) =>
  expect(latestOrdersRun(new Date(now)).toISOString()).toBe(expected),
);
it('catches up missed nights, does not repeat a successful night and waits for the next night after a failed attempt', () => {
  const now = new Date('2026-11-06T02:00:00Z');
  expect(ordersSyncDue({ lastSuccessAt: null, lastErrorAt: null }, now)).toBe(
    true,
  );
  expect(
    ordersSyncDue(
      { lastSuccessAt: new Date('2026-11-06T01:00:00Z'), lastErrorAt: null },
      now,
    ),
  ).toBe(false);
  expect(
    ordersSyncDue(
      { lastSuccessAt: new Date('2026-11-01T01:00:00Z'), lastErrorAt: null },
      now,
    ),
  ).toBe(true);
  expect(
    ordersSyncDue(
      { lastSuccessAt: null, lastErrorAt: new Date('2026-11-06T01:59:00Z') },
      now,
    ),
  ).toBe(false);
});
