import { randomUUID } from 'node:crypto';
import {
  parseAdjustment,
  adjustmentHash,
  parseAdjustmentQuery,
} from './adjustments.validation';

const base = () => ({
  itemId: '9007199254740993',
  locationId: '1',
  type: 'WRITE_OFF',
  quantity: '1.125',
  reason: ' Recount ',
  attachments: [randomUUID()],
  requestKey: randomUUID(),
});

describe('StockAdjustments contract', () => {
  it('validates query filters and pagination without coercing invalid integers', () => {
    expect(parseAdjustmentQuery({})).toMatchObject({ page: 1, limit: 50 });
    expect(
      parseAdjustmentQuery({
        itemId: '9007199254740993',
        type: 'SURPLUS',
        page: '2',
      }),
    ).toMatchObject({ itemId: 9007199254740993n, type: 'SURPLUS', page: 2 });
    for (const query of [
      { extra: true },
      { page: '-1' },
      { page: '1.5' },
      { page: '0' },
      { limit: '101' },
      { type: 'SET' },
      { locationId: '0' },
    ])
      expect(() => parseAdjustmentQuery(query)).toThrow();
  });
  it('normalizes reason, comment, quantities and attachment order for idempotency', () => {
    const input = {
      ...base(),
      attachments: [randomUUID(), randomUUID()],
      comment: '  ',
    };
    const normalized = parseAdjustment(input);
    expect(normalized).toMatchObject({
      reason: 'Recount',
      comment: null,
      mode: 'DELTA',
      itemId: '9007199254740993',
    });
    expect(
      adjustmentHash(
        parseAdjustment({
          ...input,
          attachments: [...input.attachments].reverse(),
          reason: 'Recount',
        }),
      ),
    ).toBe(adjustmentHash(normalized));
    expect(
      adjustmentHash(parseAdjustment({ ...input, quantity: '2' })),
    ).not.toBe(adjustmentHash(normalized));
  });
  it('supports actual zero with an explicit expected balance', () => {
    const input = { ...base(), type: undefined, quantity: undefined };
    expect(
      parseAdjustment({
        ...input,
        actualQuantity: '0',
        expectedQuantity: '1.125',
      }),
    ).toMatchObject({
      mode: 'ACTUAL',
      actualQuantity: '0',
      expectedQuantity: '1.125',
    });
  });
  it.each([
    { reason: '' },
    { reason: '   ' },
    { reason: '\0' },
    { reason: 'x'.repeat(1001) },
    { comment: 1 },
    { comment: 'x'.repeat(4001) },
    { type: 'SET' },
    { quantity: '-1' },
    { quantity: '0' },
    { quantity: '0.0001' },
    { quantity: 1 },
    { locationId: 1 },
    { itemId: '0' },
    { itemId: '9223372036854775808' },
    { attachments: [] },
    { attachments: ['invalid'] },
    { attachments: Array(11).fill('00000000-0000-0000-0000-000000000001') },
    { requestKey: '' },
    { extra: true },
    { actualQuantity: '2', expectedQuantity: '1' },
    { expectedQuantity: '1' },
  ])('rejects malformed input %p', (change) => {
    expect(() => parseAdjustment({ ...base(), ...change })).toThrow();
  });
  it('rejects duplicate attachment IDs and actual quantity without the expected snapshot', () => {
    const input = base();
    expect(() =>
      parseAdjustment({
        ...input,
        attachments: [input.attachments[0], input.attachments[0]],
      }),
    ).toThrow();
    const actual = { ...input, type: undefined, quantity: undefined };
    expect(() => parseAdjustment({ ...actual, actualQuantity: '1' })).toThrow();
  });
});
