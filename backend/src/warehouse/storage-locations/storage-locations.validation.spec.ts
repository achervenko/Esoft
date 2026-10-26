import {
  parseLocation,
  parseLocationQuery,
  parseLocationId,
} from './storage-locations.validation';
describe('Storage location validation', () => {
  it('trims fields and preserves explicit inactive state', () =>
    expect(
      parseLocation({ code: ' A ', name: ' Полка ', isActive: false }, true),
    ).toEqual({ code: 'A', name: 'Полка', isActive: false }));
  it.each([
    {},
    { code: ' ' },
    { name: '' },
    { code: 'x'.repeat(101) },
    { name: 'x'.repeat(256) },
    { isActive: 'false' },
    { id: '1' },
    { code: null },
  ])('rejects invalid patch %j', (body) =>
    expect(() => parseLocation(body)).toThrow(),
  );
  it('requires both create fields', () =>
    expect(() => parseLocation({ code: 'A' }, true)).toThrow());
  it('accepts the full bigint range without precision loss', () =>
    expect(parseLocationId('9223372036854775807')).toBe(9223372036854775807n));
  it.each(['0', '-1', '1.5', '1e5', '9223372036854775808', 9007199254740992])(
    'rejects invalid ID %s',
    (id) => expect(() => parseLocationId(id)).toThrow(),
  );
  it('defaults to all locations sorted by code', () =>
    expect(parseLocationQuery({})).toMatchObject({
      isActive: undefined,
      page: 1,
      limit: 50,
      sortBy: 'code',
      sortOrder: 'asc',
    }));
  it.each([
    { isActive: '0' },
    { page: '0' },
    { limit: '101' },
    { sortBy: 'id' },
    { sortOrder: 'DESC' },
    { page: '2147483647' },
    { unknown: 'x' },
  ])('rejects invalid query %j', (q) =>
    expect(() => parseLocationQuery(q)).toThrow(),
  );
});
