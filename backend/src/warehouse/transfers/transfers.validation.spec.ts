import {
  parseTransfer,
  parseTransferQuery,
  transferHash,
} from './transfers.validation';
const input = {
  requestKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  itemId: '9007199254740993',
  fromLocationId: '1',
  toLocationId: '2',
  quantity: '1.250',
  comment: ' x ',
};
describe('Transfer validation', () => {
  it('normalizes quantities and comments before hashing', () => {
    expect(parseTransfer(input).itemId).toBe('9007199254740993');
    expect(transferHash(parseTransfer(input))).toBe(
      transferHash(parseTransfer({ ...input, quantity: '1.25', comment: 'x' })),
    );
  });
  it.each([
    { requestKey: 'bad' },
    { fromLocationId: '2' },
    { quantity: '0' },
    { quantity: '0.0001' },
    { quantity: 1 },
    { itemId: '0' },
    { comment: 'x'.repeat(4001) },
    { extra: true },
  ])('rejects invalid input %j', (patch) =>
    expect(() => parseTransfer({ ...input, ...patch })).toThrow(),
  );
  it('parses warehouse and pagination filters', () =>
    expect(
      parseTransferQuery({
        warehouseId: '9007199254740993',
        page: '2',
        limit: '10',
      }),
    ).toMatchObject({ warehouseId: 9007199254740993n, page: 2, limit: 10 }));
  it.each([
    { warehouseId: '0' },
    { page: '0' },
    { limit: '101' },
    { page: '2147483647', limit: '100' },
    { extra: '1' },
  ])('rejects invalid filters %j', (q) =>
    expect(() => parseTransferQuery(q)).toThrow(),
  );
});
