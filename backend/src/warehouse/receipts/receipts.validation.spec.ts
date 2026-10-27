import {
  parseManualReceipt,
  parseReceiptQuery,
  receiptHash,
} from './receipts.validation';
const base = {
  warehouseId: '1',
  requestKey: 'acbf4fd4-89c4-4f5d-b8f2-150665d3c680',
  lines: [
    { itemId: '10', storageLocationId: '2', quantity: '2.000' },
    { itemId: '2', storageLocationId: '10', quantity: '1' },
  ],
};
describe('Receipt validation and canonical identity', () => {
  it('normalizes strings, quantities and line order without hashing row numbers', () => {
    const a = parseManualReceipt({
      ...base,
      comment: ' ',
      documentNumber: ' 42 ',
    });
    const b = parseManualReceipt({
      ...base,
      comment: null,
      documentNumber: '42',
      lines: [...base.lines].reverse().map((line) => ({
        ...line,
        quantity: line.quantity === '2.000' ? '2' : '1.000',
      })),
    });
    expect(receiptHash(a.input)).toBe(receiptHash(b.input));
    expect(a.input.lines[0].quantity).toBe('2');
    expect(a.input.lines[0].rowNumber).toBe(1);
  });
  it.each([
    { requestKey: 'text' },
    { requestKey: '00000000-0000-0000-0000-000000000000' },
    { source: 'ONE_C' },
    { createdByUserId: 'someone' },
    { documentDate: '2026-02-30' },
    { lines: [] },
    { lines: [base.lines[0], base.lines[0]] },
    { lines: [{ ...base.lines[0], quantity: 2 }] },
    { lines: [{ ...base.lines[0], quantity: '1.0001' }] },
  ])('rejects invalid input %j', (patch) =>
    expect(() => parseManualReceipt({ ...base, ...patch })).toThrow(),
  );
  it('accepts a real leap day and a normalized UUID', () => {
    expect(
      parseManualReceipt({
        ...base,
        requestKey: base.requestKey.toUpperCase(),
        documentDate: '2024-02-29',
      }).requestKey,
    ).toBe(base.requestKey);
  });
  it('validates pagination and createdAt period', () => {
    expect(parseReceiptQuery({})).toMatchObject({
      page: 1,
      limit: 50,
      offset: 0,
    });
    expect(parseReceiptQuery({ page: '2', limit: '10' }).offset).toBe(10);
    for (const q of [
      { limit: '101' },
      { page: '0' },
      { documentDate: '2026-01-01' },
      { createdFrom: '2026-01-01' },
      { createdFrom: '2026-02-30T00:00:00Z' },
      {
        createdFrom: '2026-02-01T00:00:00Z',
        createdTo: '2026-01-01T00:00:00Z',
      },
    ])
      expect(() => parseReceiptQuery(q)).toThrow();
  });
});
