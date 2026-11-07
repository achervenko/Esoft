import { ordersQuery } from './orders.validation';
it('filters closed orders without an allowlist of other statuses', () =>
  expect(
    ordersQuery({ closed: 'false', search: ' A ', page: '2' }),
  ).toMatchObject({ closed: 'false', search: 'A', page: 2 }));
it.each([
  null,
  [],
  { page: '0' },
  { limit: '101' },
  { sourceId: 'x' },
  { closed: 'yes' },
  { search: ['A'] },
  { arbitrary: 'x' },
])('rejects invalid query %j', (value) =>
  expect(() => ordersQuery(value)).toThrow(),
);
