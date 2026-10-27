import {
  parseIssue,
  parseIssueFilters,
  issueRequestHash,
} from './issues.validation';
const valid = {
  requestKey: 'acbf4fd4-89c4-4f5d-b8f2-150665d3c680',
  type: 'MANUAL',
  positions: [{ balanceId: '9007199254740993', quantity: '1.125' }],
};
describe('Issues validation', () => {
  it('accepts a sheet issue with its line ID', () => {
    const input = parseIssue({
      requestKey: valid.requestKey,
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
        search: ' Исторический кабель ',
      }),
    ).toMatchObject({
      itemIds: [1n, 2n],
      projectIds: [3n],
      search: 'Исторический кабель',
    });
    for (const filter of [
      { minQuantity: '5', maxQuantity: '1' },
      { itemId: '1', itemIds: ['1'] },
      { limit: 101 },
      { createdFrom: '2026-02-30' },
      { types: 'BAD' },
      { extra: true },
      { search: 123 },
      { search: 'x'.repeat(256) },
      { search: 'bad\0search' },
    ])
      expect(() => parseIssueFilters(filter)).toThrow();
  });
});

describe('Issue request identity', () => {
  it.each([
    undefined,
    null,
    '',
    'not-uuid',
    '00000000-0000-0000-0000-000000000000',
  ])('requires a valid UUID %s', (requestKey) =>
    expect(() => parseIssue({ ...valid, requestKey })).toThrow(),
  );
  it('allows preview without key and normalizes UUID case', () => {
    const { requestKey, ...body } = valid;
    expect(parseIssue(body, true).requestKey).toBeNull();
    expect(
      parseIssue({ ...valid, requestKey: requestKey.toUpperCase() }).requestKey,
    ).toBe(requestKey);
  });
  it('hashes normalized command without transient confirmation or key', () => {
    const a = {
      ...valid,
      overrideReservations: true,
      comment: ' Reason ',
      positions: [
        { balanceId: '10', quantity: '2.000' },
        { balanceId: '2', quantity: '1' },
      ],
    };
    const b = {
      ...a,
      comment: 'Reason',
      requestKey: 'bcbf4fd4-89c4-4f5d-b8f2-150665d3c680',
      overrideConfirmation: 'a'.repeat(64),
      positions: [...a.positions].reverse(),
    };
    expect(issueRequestHash(parseIssue(a))).toBe(
      issueRequestHash(parseIssue(b)),
    );
    expect(issueRequestHash(parseIssue({ ...a, comment: 'Other' }))).not.toBe(
      issueRequestHash(parseIssue(a)),
    );
  });
});
