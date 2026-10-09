import { getBusinessTodayDateString } from '../application/business-date';
import {
  parseIssueBatch,
  parseIssueCancellation,
  parseIssueListQuery,
  parseIssuePlanQuery,
} from './ppe-issues.validation';
import { parsePpeItem } from './ppe.validation';

const item = { normItemId: 2, ppeItemId: 3 };
const payload = { employeeId: 1, items: [item] };
function expectCode(fn: () => unknown, code: string) {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ response: { code } });
}
describe('PPE issue validation', () => {
  it('defaults to the Moscow business day without accepting snapshots', () => {
    expect(
      parseIssueBatch(payload, true, 'ppe_specialist')
        .issuedAt.toISOString()
        .slice(0, 10),
    ).toBe(getBusinessTodayDateString());
    for (const field of [
      'scheduledAt',
      'issueType',
      'actorUserId',
      'positionId',
      'employeeNameSnapshot',
    ]) {
      expectCode(
        () => parseIssueBatch({ ...payload, [field]: 'fake' }, true, 'admin'),
        'UNKNOWN_FIELDS',
      );
    }
  });
  it('accepts backdating only for admin', () => {
    expect(
      parseIssueBatch(
        { ...payload, issuedAt: '2020-01-01' },
        true,
        'admin',
      ).issuedAt.toISOString(),
    ).toBe('2020-01-01T00:00:00.000Z');
    for (const role of ['ppe_specialist', 'engineer', null]) {
      expectCode(
        () =>
          parseIssueBatch({ ...payload, issuedAt: '2020-01-01' }, true, role),
        'PPE_ISSUE_BACKDATE_FORBIDDEN',
      );
      expectCode(
        () => parseIssuePlanQuery({ issuedAt: '2020-01-01' }, role),
        'PPE_ISSUE_BACKDATE_FORBIDDEN',
      );
    }
    expectCode(
      () =>
        parseIssueBatch(
          { ...payload, issuedAt: getBusinessTodayDateString() },
          true,
          'ppe_specialist',
        ),
      'PPE_ISSUE_BACKDATE_FORBIDDEN',
    );
  });
  it('allows admin to request a historical plan date', () => {
    expect(
      parseIssuePlanQuery({ issuedAt: '2020-01-01' }, 'admin').toISOString(),
    ).toBe('2020-01-01T00:00:00.000Z');
  });
  it.each(['2026-02-30', '2026-01-01T12:00:00Z', true, null])(
    'rejects invalid actual dates %p',
    (issuedAt) => {
      expectCode(
        () => parseIssueBatch({ ...payload, issuedAt }, true, 'admin'),
        'INVALID_NORM_DATE',
      );
    },
  );
  it('forbids future actual dates', () => {
    expectCode(
      () =>
        parseIssueBatch({ ...payload, issuedAt: '9999-12-31' }, true, 'admin'),
      'PPE_ISSUE_FUTURE_DATE',
    );
  });
  it.each([true, '1', 0, -1, 1.5, Infinity, null])(
    'rejects coercible and invalid IDs %p',
    (employeeId) => {
      expectCode(
        () => parseIssueBatch({ ...payload, employeeId }, true, 'admin'),
        'INVALID_EMPLOYEE_ID',
      );
    },
  );
  it('requires a bounded nonempty batch of strict item objects', () => {
    for (const items of [[], null, 'items', Array(101).fill(item)])
      expectCode(
        () => parseIssueBatch({ ...payload, items }, true, 'admin'),
        'PPE_ISSUE_ITEMS_REQUIRED',
      );
    for (const value of [null, true, []])
      expectCode(
        () => parseIssueBatch({ ...payload, items: [value] }, true, 'admin'),
        'INVALID_PAYLOAD',
      );
    expectCode(
      () =>
        parseIssueBatch(
          { ...payload, items: [{ ...item, sizeValue: '42' }] },
          true,
          'admin',
        ),
      'UNKNOWN_FIELDS',
    );
    expectCode(
      () =>
        parseIssueBatch(
          { ...payload, items: [{ ...item, quantity: 1 }] },
          true,
          'admin',
        ),
      'UNKNOWN_FIELDS',
    );
    expectCode(
      () => parseIssueBatch(payload, false, 'admin'),
      'UNKNOWN_FIELDS',
    );
  });
  it.each([0, -1, NaN, Infinity, 1.0001, 1e9, true, '1', null])(
    'rejects invalid extra quantities %p',
    (quantity) => {
      expectCode(
        () =>
          parseIssueBatch(
            { employeeId: 1, items: [{ ppeItemId: 1, quantity }] },
            false,
            'admin',
          ),
        'INVALID_ISSUE_QUANTITY',
      );
    },
  );
  it('parses extra quantity and trims an optional comment', () => {
    const result = parseIssueBatch(
      {
        employeeId: 1,
        items: [
          { ppeItemId: 1, quantity: 1.125, sizeId: null, comment: ' extra ' },
        ],
      },
      false,
      'admin',
    );
    expect(result.items[0]).toMatchObject({
      normItemId: null,
      quantity: 1.125,
      comment: 'extra',
      sizeId: null,
    });
  });
  it('requires and bounds a cancellation reason', () => {
    for (const reason of ['', ' ', null, undefined, true, 1])
      expectCode(
        () => parseIssueCancellation({ reason }),
        'PPE_ISSUE_CANCELLATION_REASON_REQUIRED',
      );
    expectCode(
      () => parseIssueCancellation({ reason: 'x'.repeat(1001) }),
      'VALUE_TOO_LONG',
    );
    expectCode(
      () => parseIssueCancellation({ reason: 'valid', status: 'ISSUED' }),
      'UNKNOWN_FIELDS',
    );
    expect(parseIssueCancellation({ reason: ' valid ' })).toBe('valid');
  });
  it('parses journal filters strictly', () => {
    expect(
      parseIssueListQuery({
        employeeId: '1',
        positionId: '2',
        ppeItemId: '3',
        issueType: 'EXTRA',
        status: 'CANCELLED',
        dateFrom: '2020-01-01',
        dateTo: '2021-01-01',
      }),
    ).toMatchObject({
      employeeId: 1,
      positionId: 2,
      ppeItemId: 3,
      issueType: 'EXTRA',
      status: 'CANCELLED',
    });
    expectCode(
      () => parseIssueListQuery({ employeeId: '1e1' }),
      'INVALID_EMPLOYEE_ID',
    );
    expectCode(
      () => parseIssueListQuery({ issueType: 'regular' }),
      'INVALID_ISSUE_TYPE',
    );
    expectCode(
      () => parseIssueListQuery({ status: 'DELETED' }),
      'INVALID_ISSUE_STATUS',
    );
    expectCode(
      () =>
        parseIssueListQuery({ dateFrom: '2021-01-01', dateTo: '2020-01-01' }),
      'INVALID_NORM_DATE',
    );
    expectCode(() => parseIssueListQuery({ sort: 'id' }), 'UNKNOWN_FIELDS');
  });
  it('validates type in catalog mutations', () => {
    for (const type of ['OTHER', 'BODY', 'FEET', 'HANDS', 'HEAD'])
      expect(
        parsePpeItem({ article: 'A', name: 'N', unit: 'пары', type }).type,
      ).toBe(type);
    expectCode(
      () =>
        parsePpeItem({
          article: 'A',
          name: 'N',
          unit: 'пары',
          type: 'shoes',
        }),
      'INVALID_PPE_ITEM_TYPE',
    );
  });
});
