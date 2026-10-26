import { parseIssue, parseIssueFilters } from './issues.validation';
const valid = {
  type: 'MANUAL',
  positions: [{ balanceId: '9007199254740993', quantity: '1.125' }],
};
describe('Issues validation', () => {
  it('accepts a sheet issue with its line ID', () => {
    const input = parseIssue({
      type: 'ISSUE_SHEET',
      issueSheetLineId: '1',
      positions: [{ balanceId: '2', quantity: '1' }],
    });
    expect(input).toMatchObject({
      type: 'ISSUE_SHEET',
      issueSheetLineId: 1n,
      overrideReservations: false,
    });
    expect(input.positions[0].balanceId).toBe(2n);
    expect(input.positions[0].quantity.toString()).toBe('1');
  });
  it('keeps exact IDs and quantities and defaults to safe manual issue', () => {
    expect(parseIssue(valid)).toMatchObject({
      type: 'MANUAL',
      issueSheetLineId: null,
      overrideReservations: false,
    });
    expect(parseIssue(valid).positions[0].balanceId).toBe(9007199254740993n);
    expect(parseIssue(valid).positions[0].quantity.toString()).toBe('1.125');
  });
  it.each([
    { ...valid, type: 'BAD' },
    { ...valid, type: 'ISSUE_SHEET' },
    { ...valid, issueSheetLineId: '1' },
    { ...valid, issuedByUserId: 'other' },
    { ...valid, positions: [] },
    { ...valid, positions: [{ balanceId: '1', quantity: '0' }] },
    { ...valid, positions: [{ balanceId: '1', quantity: '1.0001' }] },
    {
      ...valid,
      positions: [
        { balanceId: '1', quantity: '1' },
        { balanceId: '1', quantity: '2' },
      ],
    },
    { ...valid, overrideReservations: true },
    { ...valid, overrideConfirmation: 'a'.repeat(64) },
  ])('rejects invalid or ambiguous input %o', (value) => {
    expect(() => parseIssue(value)).toThrow();
  });
  it('accepts confirmed override only with a reason', () => {
    expect(
      parseIssue({
        ...valid,
        overrideReservations: true,
        comment: ' Причина ',
        overrideConfirmation: 'a'.repeat(64),
      }),
    ).toMatchObject({ comment: 'Причина', overrideReservations: true });
  });
  it('validates filter ranges, lists and pagination', () => {
    expect(
      parseIssueFilters({
        itemIds: '1,2',
        projectId: '3',
        types: 'MANUAL,ISSUE_SHEET',
      }),
    ).toMatchObject({ itemIds: [1n, 2n], projectIds: [3n] });
    for (const filter of [
      { minQuantity: '5', maxQuantity: '1' },
      { itemId: '1', itemIds: ['1'] },
      { limit: 101 },
      { createdFrom: '2026-02-30' },
      { types: 'BAD' },
      { extra: true },
    ])
      expect(() => parseIssueFilters(filter)).toThrow();
  });
});
