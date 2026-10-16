import { parseEquipmentListQuery } from './equipment-list-query';

describe('equipment registry pagination', () => {
  it('bounds default and explicit pages', () => {
    expect(parseEquipmentListQuery({})).toMatchObject({
      page: 1,
      limit: 100,
      skip: 0,
    });
    expect(parseEquipmentListQuery({ page: '3', limit: '25' })).toMatchObject({
      page: 3,
      limit: 25,
      skip: 50,
    });
  });
  it.each([
    { limit: '101' },
    { limit: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1000001' },
    { sort: '__proto__' },
    { sort: 'name; DROP TABLE equipment' },
    { direction: 'sideways' },
  ])('rejects invalid or unsafe input %j', (query) => {
    expect(() => parseEquipmentListQuery(query)).toThrow();
  });
  it('uses a deterministic tie breaker and natural text collation', () => {
    const query = parseEquipmentListQuery({ sort: 'name', direction: 'desc' });
    expect(query.order.sql).toContain(
      'COLLATE app_registry_order DESC, e.id ASC',
    );
    expect(query.order.values).toEqual([]);
  });
  it.each([
    'visibleId',
    'name',
    'inventoryNumber',
    'serialNumber',
    'manufacturer',
    'model',
    'statusLabel',
  ])('accepts supported sort field %s', (sort) => {
    expect(() => parseEquipmentListQuery({ sort })).not.toThrow();
  });
  it('uses ascending primary and tie-breaker order for explicit asc', () => {
    const query = parseEquipmentListQuery({ sort: 'name', direction: 'asc' });
    expect(query.order.sql).toContain(
      'COLLATE app_registry_order ASC, e.id ASC',
    );
    expect(query.order.values).toEqual([]);
  });
});
