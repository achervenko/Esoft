import { parseStockOverview } from './stock-overview.validation';
describe('Stock overview filters', () => {
  it('defaults to positive groups and preserves bigint IDs', () => {
    expect(
      parseStockOverview({
        warehouseId: '9007199254740993',
        locationId: '9007199254740995',
        search: ' Кабель ',
        sortBy: 'quantity',
        sortOrder: 'desc',
        page: '2',
        limit: '10',
      }),
    ).toMatchObject({
      warehouseId: 9007199254740993n,
      locationId: 9007199254740995n,
      search: 'Кабель',
      offset: 10,
      page: 2,
      limit: 10,
    });
    expect(parseStockOverview({})).toMatchObject({
      quantityState: 'POSITIVE',
      sortBy: 'article',
      sortOrder: 'asc',
      page: 1,
    });
  });
  it.each([
    null,
    [],
    { unknown: 'x' },
    { warehouseId: '0' },
    { locationId: '1e4' },
    { search: 1 },
    { search: 'a'.repeat(256) },
    { search: 'a\0b' },
    { sortBy: 'location' },
    { sortOrder: 'ASC' },
    { quantityState: 'bad' },
    { page: '0' },
    { limit: '101' },
    { page: '2147483647', limit: '100' },
  ])('rejects malformed %j', (value) =>
    expect(() => parseStockOverview(value)).toThrow(),
  );
});
