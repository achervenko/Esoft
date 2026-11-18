import { setTimeout as delay } from 'node:timers/promises';
import type { IntegrationHttpClient } from '../../integrations/integration.contracts';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { invoiceSnapshot } from './one-c-invoice-snapshot';
import {
  assertNewInvoiceId,
  invoiceResponseLimit,
  isInvoiceSelectionComplete,
  MAX_INVOICE_PAGES,
  validateInvoicePage,
  validateInvoicePageProgress,
  validateInvoicePeriod,
} from './one-c-invoices.validation';

const MAX_ATTEMPTS = 3;
const RETRYABLE_HTTP_CODES = new Set([
  'INTEGRATION_HTTP_TIMEOUT',
  'INTEGRATION_HTTP_UNAVAILABLE',
  'INTEGRATION_HTTP_408',
  'INTEGRATION_HTTP_502',
  'INTEGRATION_HTTP_503',
  'INTEGRATION_HTTP_504',
]);

function checkCancellation(deadline: AbortSignal, external?: AbortSignal) {
  if (external?.aborted)
    throw new IntegrationFailure('INTEGRATION_HTTP_ABORTED', false);
  if (deadline.aborted)
    throw new IntegrationFailure('ONE_C_INVOICES_TIMEOUT', true);
}

async function fetchInvoicePage(
  client: IntegrationHttpClient,
  path: string,
  deadline: AbortSignal,
  external?: AbortSignal,
) {
  const signal = external ? AbortSignal.any([external, deadline]) : deadline;
  for (let attempt = 1; ; attempt++) {
    checkCancellation(deadline, external);
    try {
      const response = await client.getJson(path, signal);
      checkCancellation(deadline, external);
      return response;
    } catch (error) {
      checkCancellation(deadline, external);
      if (
        attempt >= MAX_ATTEMPTS ||
        !(error instanceof IntegrationFailure) ||
        !error.retryable ||
        !RETRYABLE_HTTP_CODES.has(error.code)
      )
        throw error;
    }
    try {
      await delay(attempt * 200, undefined, { signal });
    } catch (error) {
      checkCancellation(deadline, external);
      throw error;
    }
  }
}

export async function readOneCInvoices(
  client: IntegrationHttpClient,
  period: { dateFrom: string; dateTo: string },
  signal?: AbortSignal,
) {
  const { dateFrom, dateTo } = period;
  validateInvoicePeriod(dateFrom, dateTo);
  const deadline = AbortSignal.timeout(45_000);
  const documents = new Map<string, ReturnType<typeof invoiceSnapshot>>();
  let total: number | undefined;

  for (let page = 0; page < MAX_INVOICE_PAGES; page++) {
    const start = documents.size + 1;
    const query = new URLSearchParams({
      dateFrom,
      dateTo,
      start: String(start),
    });
    const raw = await fetchInvoicePage(
      client,
      'invoices?' + query.toString(),
      deadline,
      signal,
    );
    const response = validateInvoicePage(raw, start);
    validateInvoicePageProgress(response, documents.size, total);
    total = response.total;
    for (const entry of response.data) {
      const document = invoiceSnapshot(entry);
      assertNewInvoiceId(document.id, documents);
      documents.set(document.id, document);
    }
    if (isInvoiceSelectionComplete(documents.size, total))
      return [...documents.values()];
  }
  invoiceResponseLimit();
}
