import { parseReservationOperation } from './reservation-operations.validation';
const input = {
  action: 'BORROW',
  quantity: '1.125',
  expectedQuantity: '10',
  expectedBorrowedQuantity: '0',
  requestKey: '11111111-1111-4111-8111-111111111111',
  comment: 'Own needs',
  attachments: [],
};
it('accepts an optional document and exact decimal quantity', () => {
  expect(parseReservationOperation(input).quantity.toString()).toBe('1.125');
});
it.each([
  { comment: '' },
  { quantity: '0' },
  { quantity: '-1' },
  { quantity: '1.0001' },
  { action: 'OTHER' },
  { attachments: ['bad'] },
  { extra: 1 },
])('rejects invalid operation %j', (change) => {
  expect(() => parseReservationOperation({ ...input, ...change })).toThrow();
});

it('requires a document for release only', () => {
  expect(() =>
    parseReservationOperation({ ...input, action: 'RELEASE' }),
  ).toThrow('Для снятия резерва прикрепите документ.');
  expect(
    parseReservationOperation({
      ...input,
      action: 'RELEASE',
      attachments: [input.requestKey],
    }).attachments,
  ).toEqual([input.requestKey]);
  expect(
    parseReservationOperation({ ...input, action: 'RESTORE' }).attachments,
  ).toEqual([]);
});
