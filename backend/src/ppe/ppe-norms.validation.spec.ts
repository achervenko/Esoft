import {
  parseCreateNorm,
  parseEffectiveNormQuery,
  parseNormDate,
  parseNormListQuery,
  parseNormRevision,
} from './ppe-norms.validation';

const item = { ppeItemId: 1, quantity: 1, periodCount: 1, periodUnit: 'YEAR' };
const payload = {
  gender: 'MALE',
  positionId: 1,
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  items: [item],
};

it.each([undefined, null, 'ALL', 'male'])(
  'requires an explicit norm gender: %p',
  (gender) => {
    expectCode(
      () => parseCreateNorm({ ...payload, gender }),
      'PPE_NORM_GENDER_REQUIRED',
    );
  },
);

it('rejects attempts to change gender on an existing revision', () => {
  expectCode(
    () =>
      parseNormRevision({
        effectiveFrom: payload.effectiveFrom,
        items: [item],
        gender: 'FEMALE',
      }),
    'UNKNOWN_FIELDS',
  );
});

function expectCode(action: () => unknown, code: string) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ status: 400, response: { code } });
}

describe('PPE norm validation', () => {
  it('accepts both transition policies and interval calculation', () => {
    for (const transitionMode of ['SOFT', 'HARD'])
      expect(
        parseCreateNorm({
          ...payload,
          transitionMode,
          items: [item],
        }),
      ).toMatchObject({
        transitionMode,
        items: [item],
      });
  });
  it('rejects unknown transition and calculation policies', () => {
    expectCode(
      () => parseCreateNorm({ ...payload, transitionMode: 'RESET' }),
      'INVALID_NORM_TRANSITION_MODE',
    );
    expectCode(
      () =>
        parseCreateNorm({
          ...payload,
          items: [{ ...item, calculationMode: 'AUTO' }],
        }),
      'UNKNOWN_FIELDS',
    );
    expectCode(
      () => parseCreateNorm({ ...payload, transitionMode: ['SOFT'] }),
      'INVALID_NORM_TRANSITION_MODE',
    );
    expectCode(
      () =>
        parseCreateNorm({
          ...payload,
          items: [{ ...item, calculationMode: ['MONTHLY'] }],
        }),
      'UNKNOWN_FIELDS',
    );
  });
  it('parses a complete norm without changing periodicity', () => {
    const result = parseCreateNorm({
      ...payload,
      items: [{ ...item, quantity: 12, periodCount: 2, periodUnit: 'MONTH' }],
    });
    expect(result).toEqual({
      gender: 'MALE',
      positionId: 1,
      effectiveFrom: new Date('2027-01-01T00:00:00Z'),
      effectiveTo: null,
      items: [
        {
          ...item,
          quantity: 12,
          periodCount: 2,
          periodUnit: 'MONTH',
        },
      ],
    });
  });

  it.each([null, [], 'norm', 1, undefined])(
    'rejects non-object root %p',
    (value) => {
      expectCode(() => parseCreateNorm(value), 'INVALID_PAYLOAD');
    },
  );
  it('rejects unknown root and item fields', () => {
    expectCode(
      () => parseCreateNorm({ ...payload, actorUserId: 'fake' }),
      'UNKNOWN_FIELDS',
    );
    expectCode(
      () => parseCreateNorm({ ...payload, items: [{ ...item, id: 7 }] }),
      'UNKNOWN_FIELDS',
    );
    expectCode(() => parseNormRevision(payload), 'UNKNOWN_FIELDS');
  });
  it.each([[], null, {}, undefined])(
    'requires a nonempty item array %p',
    (items) => {
      expectCode(
        () => parseCreateNorm({ ...payload, items }),
        'PPE_NORM_ITEMS_REQUIRED',
      );
    },
  );
  it.each([null, [], true, 'item'])('requires item objects %p', (value) => {
    expectCode(
      () => parseCreateNorm({ ...payload, items: [value] }),
      'INVALID_PAYLOAD',
    );
  });
  it('rejects repeated PPE IDs before writing', () => {
    expectCode(
      () =>
        parseCreateNorm({
          ...payload,
          items: [item, { ...item, quantity: 2 }],
        }),
      'PPE_NORM_ITEM_DUPLICATE',
    );
  });
  it.each([
    0,
    -1,
    1.5,
    '1',
    true,
    null,
    undefined,
    NaN,
    Infinity,
    2_147_483_648,
  ])('rejects invalid IDs %p', (id) => {
    expectCode(
      () => parseCreateNorm({ ...payload, positionId: id }),
      'INVALID_POSITION_ID',
    );
    expectCode(
      () =>
        parseCreateNorm({ ...payload, items: [{ ...item, ppeItemId: id }] }),
      'INVALID_PPE_ITEM_ID',
    );
  });
  it.each([
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    1.0001,
    0.0001,
    1e9,
    '1',
    true,
    null,
    undefined,
  ])('rejects invalid quantity %p', (quantity) => {
    expectCode(
      () => parseCreateNorm({ ...payload, items: [{ ...item, quantity }] }),
      'INVALID_NORM_QUANTITY',
    );
  });
  it.each([0.001, 1, 1.123, 999_999_999.999])(
    'accepts NUMERIC(12,3) quantity %p',
    (quantity) => {
      expect(
        parseCreateNorm({ ...payload, items: [{ ...item, quantity }] }).items[0]
          .quantity,
      ).toBe(quantity);
    },
  );
  it.each([0, -1, 1.5, '1', true, NaN, Infinity, 2_147_483_648])(
    'rejects invalid period count %p',
    (periodCount) => {
      expectCode(
        () =>
          parseCreateNorm({ ...payload, items: [{ ...item, periodCount }] }),
        'INVALID_NORM_PERIOD',
      );
    },
  );
  it.each(['WEEK', 'year', ' YEAR ', true, 1, null, undefined])(
    'rejects invalid unit %p',
    (periodUnit) => {
      expectCode(
        () => parseCreateNorm({ ...payload, items: [{ ...item, periodUnit }] }),
        'INVALID_NORM_PERIOD',
      );
    },
  );
  it.each([
    '2027-02-29',
    '2027-04-31',
    '2027-13-01',
    '2027-00-01',
    '2027-01-00',
    '0000-01-01',
    '2027-1-01',
    '2027-01-01T00:00:00Z',
    ' 2027-01-01',
    '',
    true,
    null,
    undefined,
  ])('rejects invalid date %p', (date) => {
    expectCode(() => parseNormDate(date), 'INVALID_NORM_DATE');
  });
  it('accepts leap dates and an inclusive single-day period', () => {
    expect(parseNormDate('2028-02-29').toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(
      parseCreateNorm({ ...payload, effectiveTo: payload.effectiveFrom })
        .effectiveTo,
    ).toEqual(new Date('2027-01-01T00:00:00Z'));
  });
  it('rejects a reversed period', () => {
    expectCode(
      () => parseCreateNorm({ ...payload, effectiveTo: '2026-12-31' }),
      'INVALID_NORM_DATE',
    );
  });
  it('treats omitted effectiveTo as an open period', () => {
    expect(
      parseNormRevision({ effectiveFrom: payload.effectiveFrom, items: [item] })
        .effectiveTo,
    ).toBeNull();
  });
  it('validates query fields and query IDs without permissive conversions', () => {
    expect(parseNormListQuery({})).toBeUndefined();
    expect(parseNormListQuery({ positionId: '1' })).toBe(1);
    expect(
      parseEffectiveNormQuery({ date: '2028-02-29', gender: 'MALE' }),
    ).toEqual({ date: new Date('2028-02-29T00:00:00Z'), gender: 'MALE' });
    expectCode(() => parseEffectiveNormQuery({}), 'PPE_NORM_GENDER_REQUIRED');
    for (const value of [true, '1e1', '1.5', '-1', ' 1', ['1'], 1]) {
      expectCode(
        () => parseNormListQuery({ positionId: value }),
        'INVALID_POSITION_ID',
      );
    }
    expectCode(
      () => parseNormListQuery({ status: 'active' }),
      'UNKNOWN_FIELDS',
    );
    expectCode(() => parseEffectiveNormQuery({ extra: 'x' }), 'UNKNOWN_FIELDS');
  });
});

it.each(['DAY', 'MONTH', 'YEAR'])('accepts period unit %s', (periodUnit) => {
  expect(
    parseCreateNorm({ ...payload, items: [{ ...item, periodUnit }] }).items[0],
  ).toMatchObject({ periodUnit });
});
it.each(['INTERVAL', 'LEGACY', 'MONTHLY'])(
  'rejects removed calculation mode %s',
  (calculationMode) => {
    expectCode(
      () =>
        parseCreateNorm({ ...payload, items: [{ ...item, calculationMode }] }),
      'UNKNOWN_FIELDS',
    );
  },
);
