import {
  assertNewInvoiceId,
  isInvoiceSelectionComplete,
  validateInvoicePage,
  validateInvoicePageProgress,
  validateInvoicePeriod,
} from './one-c-invoices.validation';

const start = '2026-11-14T07:00:00';
const end = '2026-11-15T23:59:59';

it.each([start, end])('accepts a valid period ending at %s', (dateTo) => {
  expect(() => validateInvoicePeriod(start, dateTo)).not.toThrow();
});

it.each([
  '2026-11-14T06:59:59',
  '2026-11-15T23:59:59Z',
  '2026-02-30T00:00:00',
  '2026-11-15T24:00:00',
  undefined,
  123,
])('rejects invalid period end %s', (dateTo) => {
  expect(() => validateInvoicePeriod(start, dateTo)).toThrow(
    'ONE_C_INVOICES_PERIOD_INVALID',
  );
});

const page = { Start_number: 1, Total_number: 1, data: [{}] };

it.each([
  [40, 0, false],
  [50, 0, true],
  [20, 50, false],
  [20, 100, true],
])('checks a page of %i after %i of 120 documents', (size, received, valid) => {
  const validate = () =>
    validateInvoicePageProgress(
      { total: 120, data: Array.from({ length: size }, () => ({})) },
      received,
      received ? 120 : undefined,
    );
  if (valid) {
    expect(validate).not.toThrow();
    return;
  }
  expect.assertions(1);
  try {
    validate();
  } catch (error) {
    expect(error).toMatchObject({
      code: 'ONE_C_INVOICES_INCOMPLETE',
      retryable: false,
    });
  }
});

it('reads valid metadata', () => {
  expect(validateInvoicePage(page, 1)).toEqual({ total: 1, data: [{}] });
});

it.each([
  null,
  [],
  { ...page, data: undefined },
  { ...page, data: Array(51).fill({}) },
  { ...page, Total_number: '1' },
  { ...page, Total_number: -1 },
  { ...page, Total_number: 1.5 },
  { ...page, Total_number: Number.MAX_SAFE_INTEGER + 1 },
  { ...page, Start_number: 2 },
  { ...page, Start_number: 1.5 },
])('rejects invalid page %j', (value) => {
  expect(() => validateInvoicePage(value, 1)).toThrow(
    'ONE_C_INVOICES_RESPONSE_INVALID',
  );
});

it('rejects excess rows and oversized selections', () => {
  expect(() =>
    validateInvoicePageProgress({ total: 1, data: [{}] }, 1, 1),
  ).toThrow('ONE_C_INVOICES_INCOMPLETE');
  expect(() =>
    validateInvoicePageProgress({ total: 5001, data: [{}] }, 0, undefined),
  ).toThrow('ONE_C_INVOICES_RESPONSE_LIMIT');
});

it('detects duplicate IDs and verifies the final count', () => {
  expect(() => assertNewInvoiceId('id', new Map([['id', {}]]))).toThrow(
    'ONE_C_INVOICES_INCOMPLETE',
  );
  expect(isInvoiceSelectionComplete(49, 50)).toBe(false);
  expect(isInvoiceSelectionComplete(50, 50)).toBe(true);
});
