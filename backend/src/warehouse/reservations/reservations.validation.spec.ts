import {
  parseReservation,
  parseReservationQuery,
} from './reservations.validation';
describe('Reservation validation', () => {
  it('preserves exact bigint and decimal input', () => {
    const r = parseReservation(
      { balanceId: '9007199254740993', projectId: '7', quantity: '12.001' },
      true,
    );
    expect(r.balanceId).toBe(9007199254740993n);
    expect(r.quantity.toString()).toBe('12.001');
  });
  it.each([
    {},
    null,
    [],
    { quantity: '0' },
    { quantity: 12 },
    { quantity: '1.0001' },
    { quantity: '-1' },
    { quantity: '1', balanceId: '2' },
    { quantity: '1', projectId: '2' },
  ])('rejects invalid patch %j', (v) =>
    expect(() => parseReservation(v)).toThrow(),
  );
  it.each([
    { balanceId: '01', projectId: '1', quantity: '1' },
    { projectId: '1', quantity: '1' },
    { balanceId: '1', quantity: '1' },
  ])('rejects invalid create %j', (v) =>
    expect(() => parseReservation(v, true)).toThrow(),
  );
  it.each([
    { page: '0' },
    { limit: '101' },
    { unknown: '1' },
    { balanceId: ['1'] },
    { projectId: '9223372036854775808' },
  ])('rejects invalid query %j', (v) =>
    expect(() => parseReservationQuery(v)).toThrow(),
  );
});

it('validates warehouse filters without losing bigint precision', () => {
  expect(
    parseReservationQuery({ warehouseId: '9007199254740993' }).warehouseId,
  ).toBe(9007199254740993n);
  expect(() => parseReservationQuery({ warehouseId: '0' })).toThrow();
});
