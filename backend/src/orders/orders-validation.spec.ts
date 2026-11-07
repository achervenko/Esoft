import { ordersQuery } from './orders.validation';

it('accepts multiple exact statuses and deletion modes', () => {
  expect(
    ordersQuery({
      statuses: '["Закрыт","КОбеспечению","Закрыт"]',
      deleted: 'all',
    }),
  ).toMatchObject({
    statuses: ['Закрыт', 'КОбеспечению'],
    deleted: 'all',
  });
});

it.each([
  { statuses: 'broken' },
  { statuses: '{}' },
  { statuses: '[null]' },
  { statuses: '[""]' },
  { statuses: '["Закрыт"]', closed: 'true' },
  { deleted: 'invalid' },
])('rejects invalid order filters %j', (query) => {
  expect(() => ordersQuery(query)).toThrow();
});
