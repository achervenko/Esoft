import { parseReceiptEvent } from './receipt-integration.validation';
const manual = { requestKey: 'acbf4fd4-89c4-4f5d-b8f2-150665d3c680' };
it('validates event identity and monotonic version representation', () => {
  expect(
    parseReceiptEvent({
      eventId: manual.requestKey,
      objectId: 'receipt',
      version: '2',
      type: 'RECEIPT_CHANGED',
    }).version,
  ).toBe('2');
  expect(() =>
    parseReceiptEvent({
      eventId: manual.requestKey,
      objectId: 'receipt',
      version: '2026-10-29',
      type: 'RECEIPT_CHANGED',
    }),
  ).toThrow();
});
