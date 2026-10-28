import {
  parseLocation,
  parseLocationQuery,
  parseLocationId,
  parseStorageLocationQuery,
  parseStorageEntry,
} from './storage-locations.validation';
describe('Storage location validation', () => {
  it('trims fields and preserves explicit inactive state', () =>
    expect(
      parseLocation(
        {
          name: ' Полка ',
          isActive: false,
          warehouseId: '9007199254740993',
        },
        true,
      ),
    ).toEqual({
      name: 'Полка',
      isActive: false,
      warehouseId: 9007199254740993n,
    }));
  it.each([
    {},
    { code: ' ' },
    { name: '' },
    { code: 'x'.repeat(101) },
    { name: 'x'.repeat(256) },
    { isActive: 'false' },
    { id: '1' },
    { warehouseId: '1' },
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
  it('defaults to all locations sorted by name', () =>
    expect(parseLocationQuery({})).toMatchObject({
      isActive: undefined,
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
    }));
  it.each([
    { isActive: '0' },
    { page: '0' },
    { limit: '101' },
    { sortBy: 'id' },
    { sortBy: 'code' },
    { sortOrder: 'DESC' },
    { page: '2147483647' },
    { unknown: 'x' },
  ])('rejects invalid query %j', (q) =>
    expect(() => parseLocationQuery(q)).toThrow(),
  );
});

describe('Warehouse membership validation', () => {
  it('requires an explicit warehouse on creation', () => {
    expect(() => parseLocation({ name: 'Shelf' }, true)).toThrow();
    expect(() =>
      parseLocation({ name: 'Shelf', warehouseId: 1 }, true),
    ).toThrow();
    expect(() =>
      parseLocation({ name: 'Shelf', warehouseId: '01' }, true),
    ).toThrow();
  });
  it('keeps warehouse identity out of warehouse entry payloads', () => {
    expect(parseStorageEntry({ name: ' Warehouse ' }, true)).toEqual({
      name: 'Warehouse',
    });
    expect(() => parseStorageEntry({ warehouseId: '1' })).toThrow();
  });
  it('filters locations by a full precision warehouse ID', () => {
    expect(
      parseStorageLocationQuery({ warehouseId: '9007199254740993' })
        .warehouseId,
    ).toBe(9007199254740993n);
    expect(() => parseStorageLocationQuery({ warehouseId: '0' })).toThrow();
  });
});
