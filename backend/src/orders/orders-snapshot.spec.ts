import { randomUUID } from 'node:crypto';
import { orderSnapshot, ordersCollection, readOrders } from './orders-snapshot';
const raw = () => ({
  Ref_Key: randomUUID(),
  Number: '0000-000721',
  IR_Проект: '',
  Date: '2026-09-21T13:59:49',
  Статус: 'Закрыт',
  Posted: true,
  DeletionMark: false,
});
it('accepts empty names and arbitrary statuses without turning flags into a status', () => {
  expect(
    orderSnapshot({
      ...raw(),
      Статус: 'НовыйСтатус',
      Posted: false,
      DeletionMark: true,
    }),
  ).toMatchObject({
    name: '',
    status: 'НовыйСтатус',
    posted: false,
    deletionMark: true,
  });
});
it.each([
  { Ref_Key: undefined, Posted: false },
  { Ref_Key: null, Posted: false },
  { Ref_Key: undefined },
  { Ref_Key: null },
  { Ref_Key: '' },
  { Ref_Key: '00000000-0000-0000-0000-000000000000' },
  { Ref_Key: 'not-id' },
  { Date: '2026-02-30T00:00:00' },
  { Posted: 'true' },
  { DeletionMark: null },
  { Статус: '' },
  { IR_Проект: null },
])('rejects malformed snapshots %j', (patch) =>
  expect(() => orderSnapshot({ ...raw(), ...patch })).toThrow(),
);
it('reads past short pages, selects only required fields and orders by stable identity', async () => {
  const getJson = jest
    .fn()
    .mockResolvedValueOnce({ value: [raw()] })
    .mockResolvedValueOnce({ value: [raw()] })
    .mockResolvedValueOnce({ value: [] });
  expect(await readOrders({ getJson }, ordersCollection({}))).toHaveLength(2);
  const paths = (getJson.mock.calls as [string][]).map(
    ([path]) => new URL(path, 'http://test/'),
  );
  expect(paths.map((p) => p.searchParams.get('$skip'))).toEqual([
    '0',
    '1',
    '2',
  ]);
  expect(paths[0].searchParams.get('$orderby')).toBe('Ref_Key asc');
  expect(paths[0].searchParams.has('$filter')).toBe(false);
});
it.each([
  undefined,
  null,
  '',
  'not-id',
  '00000000-0000-0000-0000-000000000000',
])('rejects an invalid OData key on a later page: %s', async (Ref_Key) => {
  const getJson = jest
    .fn()
    .mockResolvedValueOnce({ value: [raw()] })
    .mockResolvedValueOnce({ value: [{ ...raw(), Ref_Key }] });
  await expect(
    readOrders({ getJson }, ordersCollection({})),
  ).rejects.toMatchObject({ code: 'ORDERS_RESPONSE_INVALID' });
  expect(getJson).toHaveBeenCalledTimes(2);
});
it('fails on a repeated identity rather than accepting an inconsistent page sequence', async () => {
  const row = raw();
  const getJson = jest.fn().mockResolvedValue({ value: [row] });
  await expect(
    readOrders({ getJson }, ordersCollection({})),
  ).rejects.toMatchObject({ code: 'ORDERS_RESPONSE_INVALID' });
});
it('does not silently truncate unsupported continuation responses', async () => {
  await expect(
    readOrders(
      {
        getJson: jest
          .fn()
          .mockResolvedValue({ value: [raw()], 'odata.nextLink': 'elsewhere' }),
      },
      ordersCollection({}),
    ),
  ).rejects.toMatchObject({ code: 'ORDERS_PAGINATION_UNSUPPORTED' });
});
it.each([
  { collectionPath: 'https://other/' },
  { collectionPath: '../secret' },
  { collectionPath: '/outside' },
  { password: 'secret' },
])('rejects unsafe collection configuration %j', (config) =>
  expect(() => ordersCollection(config)).toThrow(),
);
