import { IntegrationFailure } from '../../integrations/integration-errors';
import type { OneCInvoicePeriodImportService } from './one-c-invoice-period-import.service';

type Result = Awaited<
  ReturnType<OneCInvoicePeriodImportService['importPeriod']>
>;
type WindowResult = {
  outcome: Result['outcome'];
  errorCode: string | null;
  received: number;
  processed: number;
  skipped: number;
  errors: number;
};

export async function importScheduledInvoiceWindow(
  importer: OneCInvoicePeriodImportService,
  code: string,
  from: Date,
  to: Date,
  format: (date: Date) => string,
  signal: AbortSignal,
  beforeRead: () => Promise<void>,
): Promise<WindowResult> {
  const documents = new Map<string, Result['documents'][number]>();
  let outcome: Result['outcome'] = 'SUCCESS';
  let errorCode: string | null = null;

  async function read(first: Date, last: Date): Promise<void> {
    signal.throwIfAborted();
    await beforeRead();
    const firstLocal = Date.parse(format(first) + 'Z');
    const lastLocal = Date.parse(format(last) + 'Z');
    // An offset decrease repeats wall-clock times. Include both sides of the fold.
    const fold = Math.max(
      0,
      firstLocal - first.getTime() - (lastLocal - last.getTime()),
    );
    const dateFrom = new Date(firstLocal - fold).toISOString().slice(0, 19);
    const dateTo = new Date(lastLocal + fold).toISOString().slice(0, 19);
    let result: Result;
    try {
      result = await importer.importPeriod(
        code,
        { dateFrom, dateTo },
        signal,
        beforeRead,
      );
    } catch (error) {
      const middle =
        Math.floor((first.getTime() + last.getTime()) / 2000) * 1000;
      if (
        !(error instanceof IntegrationFailure) ||
        (error.code !== 'ONE_C_INVOICES_RESPONSE_LIMIT' &&
          error.code !== 'ONE_C_INVOICES_TIMEOUT') ||
        middle <= first.getTime() ||
        dateFrom === dateTo
      )
        throw error;
      await read(first, new Date(middle));
      if (outcome === 'SUCCESS') await read(new Date(middle), last);
      return;
    }
    for (const document of result.documents)
      documents.set(document.invoiceId, document);
    if (result.outcome !== 'SUCCESS') {
      outcome = [...documents.values()].some(
        (document) => document.outcome === 'PROCESSED',
      )
        ? 'PARTIAL_FAILURE'
        : result.outcome;
      errorCode =
        result.documents.find((document) => document.code)?.code ??
        'ONE_C_INVOICE_PERIOD_UNCONFIRMED';
    }
  }

  try {
    await read(from, to);
  } catch (error) {
    if (!documents.size || !(error instanceof IntegrationFailure)) throw error;
    outcome = 'PARTIAL_FAILURE';
    errorCode = error.code;
  }
  const summary = [...documents.values()];
  return {
    outcome,
    errorCode,
    received: summary.length,
    processed: summary.filter((document) => document.outcome === 'PROCESSED')
      .length,
    skipped: summary.filter((document) => document.outcome === 'SUPERSEDED')
      .length,
    errors: summary.filter((document) => document.outcome === 'FAILED').length,
  };
}
