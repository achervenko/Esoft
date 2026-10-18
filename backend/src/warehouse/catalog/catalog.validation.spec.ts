import {
  parseCatalogItem,
  parseCatalogQuery,
  parseCatalogStatus,
  parseWarehouseId,
} from './catalog.validation';

describe('warehouse catalog validation', () => {
  it('keeps bigint IDs exact and rejects unsafe representations', () => {
    expect(parseWarehouseId('9007199254740993')).toBe(9007199254740993n);
    expect(parseWarehouseId('9223372036854775807')).toBe(9223372036854775807n);
    for (const value of [
      1,
      1n,
      '0',
      '-1',
      '01',
      '1.0',
      '1e3',
      ' 1',
      '9223372036854775808',
      null,
    ])
      expect(() => parseWarehouseId(value)).toThrow();
  });
  it('validates create and partial updates without integration fields', () => {
    expect(
      parseCatalogItem({ article: ' A ', name: ' Item ', unit: ' шт ' }, true),
    ).toEqual({ article: 'A', name: 'Item', unit: 'шт', comment: null });
    expect(parseCatalogItem({ comment: '   ' })).toEqual({ comment: null });
    expect(parseCatalogItem({ name: 'New' })).toEqual({ name: 'New' });
    for (const value of [
      {},
      null,
      [],
      { id: '1' },
      { isActive: false },
      { externalId: '1' },
      { nameSource: 'ONE_C' },
      { unitId: '1' },
      { name: '' },
      { unit: 'a'.repeat(51) },
      { article: 'a'.repeat(101) },
      { name: 'a'.repeat(256) },
      { comment: 12 },
      { name: 'a\0b' },
    ])
      expect(() => parseCatalogItem(value)).toThrow();
    expect(() =>
      parseCatalogItem({ article: 'A', name: 'Item' }, true),
    ).toThrow();
  });
  it('separates activation and validates pagination and filters', () => {
    expect(parseCatalogStatus({ isActive: false })).toEqual({
      isActive: false,
    });
    for (const value of [
      {},
      { isActive: 'false' },
      { isActive: true, name: 'x' },
    ])
      expect(() => parseCatalogStatus(value)).toThrow();
    expect(
      parseCatalogQuery({
        q: ' bolt ',
        isActive: 'true',
        limit: '10',
        offset: '5',
      }),
    ).toEqual({ q: 'bolt', isActive: true, limit: 10, offset: 5 });
    expect(parseCatalogQuery({})).toMatchObject({ limit: 50, offset: 0 });
    for (const value of [
      { limit: '0' },
      { limit: '101' },
      { offset: '-1' },
      { limit: ['1'] },
      { isActive: 'yes' },
      { q: {} },
      { q: 'x'.repeat(256) },
      { unknown: '1' },
    ])
      expect(() => parseCatalogQuery(value)).toThrow();
  });
});
