import { IntegrationFailure } from '../../integrations/integration-errors';

const PAGE_SIZE = 50;
export const MAX_INVOICE_PAGES = 100;

export function invalidInvoiceResponse(): never {
  throw new IntegrationFailure('ONE_C_INVOICES_RESPONSE_INVALID', false);
}

function incomplete(): never {
  throw new IntegrationFailure('ONE_C_INVOICES_INCOMPLETE', false);
}

export function invoiceResponseLimit(): never {
  throw new IntegrationFailure('ONE_C_INVOICES_RESPONSE_LIMIT', false);
}

export function invoiceTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return false;
  const date = new Date(value + 'Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value
  );
}

export function validateInvoicePeriod(dateFrom: unknown, dateTo: unknown) {
  // Fixed-width local timestamps sort chronologically without timezone conversion.
  if (
    !invoiceTimestamp(dateFrom) ||
    !invoiceTimestamp(dateTo) ||
    dateFrom > dateTo
  )
    throw new IntegrationFailure('ONE_C_INVOICES_PERIOD_INVALID', false);
}

export function invoiceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalidInvoiceResponse();
  return value as Record<string, unknown>;
}

export function validateInvoicePage(value: unknown, expectedStart: number) {
  const {
    Start_number: start,
    Total_number: total,
    data,
  } = invoiceRecord(value);
  if (
    !Number.isSafeInteger(start) ||
    start !== expectedStart ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(data) ||
    data.length > PAGE_SIZE
  )
    invalidInvoiceResponse();
  return { total, data: data as unknown[] };
}

export function validateInvoicePageProgress(
  page: ReturnType<typeof validateInvoicePage>,
  received: number,
  previousTotal: number | undefined,
) {
  const { total, data } = page;
  if (
    (previousTotal !== undefined && total !== previousTotal) ||
    received + data.length > total ||
    (!data.length && received < total)
  )
    incomplete();
  if (total > PAGE_SIZE * MAX_INVOICE_PAGES) invoiceResponseLimit();
  if (received + data.length < total && data.length < PAGE_SIZE) incomplete();
}

export function assertNewInvoiceId(
  id: string,
  documents: ReadonlyMap<string, unknown>,
) {
  if (documents.has(id)) incomplete();
}

export function isInvoiceSelectionComplete(received: number, total: number) {
  return received === total;
}
