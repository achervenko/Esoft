import { parseProjectsQuery } from './projects.validation';
it('parses search, activity and pages', () =>
  expect(
    parseProjectsQuery({
      search: ' A ',
      isActive: 'false',
      page: '2',
      limit: '10',
    }),
  ).toEqual({ search: 'A', isActive: false, page: 2, limit: 10 }));
it.each([
  null,
  [],
  { unknown: '1' },
  { isActive: true },
  { isActive: '0' },
  { page: '0' },
  { limit: '101' },
  { page: '2147483647' },
  { search: ['A'] },
  { search: 'x'.repeat(256) },
])('rejects malformed query %j', (v) =>
  expect(() => parseProjectsQuery(v)).toThrow(),
);
