import { parseSourceReceipt } from './receipts-import.contract';
import {
  parseManualReceipt,
  parsePlacement,
  parseReceiptQuery,
  receiptHash,
} from './receipts.validation';
const manual = {
  warehouseId: '1',
  requestKey: 'acbf4fd4-89c4-4f5d-b8f2-150665d3c680',
  lines: [{ itemId: '2', quantity: '2.000' }],
};
it('validates draft references and normalizes catalog input before creating a receipt', () => {
  const draftId = 'acbf4fd4-89c4-4f5d-b8f2-150665d3c681';
  const value = {
    ...manual,
    newItems: [
      { draftId, item: { article: ' NEW ', name: ' New item ', unit: ' кг ' } },
    ],
    lines: [{ draftId, quantity: '1.000' }],
  };
  expect(parseManualReceipt(value).input.newItems?.[0].item).toMatchObject({
    article: 'NEW',
    name: 'New item',
    unit: 'кг',
  });
  expect(() => parseManualReceipt({ ...value, newItems: [] })).toThrow();
  expect(() =>
    parseManualReceipt({
      ...value,
      lines: [{ draftId, itemId: '2', quantity: '1' }],
    }),
  ).toThrow();
  expect(() =>
    parseManualReceipt({
      ...value,
      newItems: [...value.newItems, ...value.newItems],
    }),
  ).toThrow();
});
it('defaults to creation date descending and accepts received date sorting', () => {
  expect(parseReceiptQuery({})).toMatchObject({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  expect(
    parseReceiptQuery({ sortBy: 'receivedAt', sortOrder: 'desc' }),
  ).toMatchObject({ sortBy: 'receivedAt', sortOrder: 'desc' });
  expect(
    parseReceiptQuery({ sortBy: 'documentNumber', sortOrder: 'asc' }),
  ).toMatchObject({ sortBy: 'documentNumber', sortOrder: 'asc' });
  expect(() => parseReceiptQuery({ sortBy: 'quantity' })).toThrow();
  expect(() => parseReceiptQuery({ sortOrder: 'other' })).toThrow();
});
it('treats conflict as an additional filter state, not a persisted status', () => {
  expect(parseReceiptQuery({ status: 'CONFLICT' })).toMatchObject({
    status: [],
    includeConflicts: true,
  });
  expect(parseReceiptQuery({ status: 'PLACED,CONFLICT' })).toMatchObject({
    status: ['PLACED'],
    includeConflicts: true,
  });
  expect(parseReceiptQuery({ status: 'PLACED' })).toMatchObject({
    status: ['PLACED'],
    includeConflicts: false,
  });
});
const source = {
  id: 'receipt',
  number: '125',
  date: '2026-10-29',
  version: '1',
  status: 'POSTED',
  warehouse: { id: 'wh', name: 'Склад' },
  lines: [
    {
      id: 'line',
      item: {
        id: 'item',
        article: ' A–А ',
        name: ' Товар ',
        unit: 'шт',
        type: 'GOODS',
      },
      quantity: '10.001',
      order: { id: 'order', number: '123', name: 'Заказ' },
    },
  ],
};
describe('Receipt document and placement contracts', () => {
  it('normalizes manual quantities but does not accept placement in a document', () => {
    expect(parseManualReceipt(manual).input.lines[0].quantity).toBe('2');
    expect(() =>
      parseManualReceipt({
        ...manual,
        lines: [{ ...manual.lines[0], storageLocationId: '1' }],
      }),
    ).toThrow();
    expect(receiptHash(parseManualReceipt(manual).input)).toBe(
      receiptHash(
        parseManualReceipt({
          ...manual,
          lines: [{ itemId: '2', quantity: '2' }],
        }).input,
      ),
    );
  });
  it.each([
    { requestKey: 'text' },
    { lines: [] },
    { lines: [{ itemId: '2', quantity: 2 }] },
    { lines: [{ itemId: '2', quantity: '0' }] },
    { lines: [{ itemId: '2', quantity: '1.0001' }] },
    { documentDate: '2026-02-30' },
  ])('rejects invalid manual data %j', (patch) =>
    expect(() => parseManualReceipt({ ...manual, ...patch })).toThrow(),
  );
  it('keeps source spelling and supports line orders', () => {
    const parsed = parseSourceReceipt(source);
    expect(parsed.lines[0].item.article).toBe(' A–А ');
    expect(parsed.lines[0].item.name).toBe(' Товар ');
    expect(parsed.lines[0].order?.id).toBe('order');
  });
  it.each([
    { version: '1.1' },
    { version: 1 },
    { date: '2026-10-29T12:00:00' },
    { lines: [{ ...source.lines[0], id: undefined }] },
    { lines: [source.lines[0], source.lines[0]] },
    { lines: [{ ...source.lines[0], quantity: 10.001 }] },
  ])('rejects ambiguous source data %j', (patch) =>
    expect(() => parseSourceReceipt({ ...source, ...patch })).toThrow(),
  );
  it('retains service lines for explicit line-level rejection, not stock movement', () =>
    expect(
      parseSourceReceipt({
        ...source,
        lines: [
          {
            ...source.lines[0],
            item: { ...source.lines[0].item, type: 'SERVICE' },
          },
        ],
      }).lines[0].item.type,
    ).toBe('SERVICE'));
  it('requires a UUID per placement and decimal strings', () => {
    expect(
      parsePlacement({
        requestKey: manual.requestKey,
        storageLocationId: '3',
        quantity: '1.000',
      }).quantity,
    ).toBe('1');
    expect(() =>
      parsePlacement({
        requestKey: manual.requestKey,
        storageLocationId: '3',
        quantity: '-1',
      }),
    ).toThrow();
  });
  it('defaults to the active work list and supports explicit history', () => {
    expect(parseReceiptQuery({})).toMatchObject({
      status: ['RECEIVED', 'PLACING'],
      page: 1,
      limit: 50,
    });
    expect(
      parseReceiptQuery({ status: 'PLACED,CANCELLED', page: '2', limit: '10' })
        .offset,
    ).toBe(10);
    for (const q of [
      { status: 'BAD' },
      { limit: '101' },
      { page: '0' },
      { hasProblems: 'yes' },
      { createdFrom: '2026-01-01' },
      { createdFrom: '2026-02-30T00:00:00Z' },
    ])
      expect(() => parseReceiptQuery(q)).toThrow();
  });
});

it('validates inclusive civil document date ranges independently of received timestamps', () => {
  expect(
    parseReceiptQuery({
      documentDateFrom: '2026-10-01',
      documentDateTo: '2026-10-31',
    }),
  ).toMatchObject({
    documentDateFrom: '2026-10-01',
    documentDateTo: '2026-10-31',
  });
  for (const query of [
    { documentDateFrom: '2026-02-30' },
    { documentDateTo: '' },
    { documentDateFrom: '2026-10-31', documentDateTo: '2026-10-01' },
  ])
    expect(() => parseReceiptQuery(query)).toThrow();
});

it('accepts only explicit attention reasons', () => {
  for (const attention of ['WAREHOUSE', 'ITEMS', 'MANUAL_DUPLICATE'])
    expect(parseReceiptQuery({ attention }).attention).toBe(attention);
  expect(() => parseReceiptQuery({ attention: 'other' })).toThrow();
});
