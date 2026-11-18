import { Injectable } from '@nestjs/common';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { importScheduledInvoiceWindow } from './invoice-schedule-import';
import {
  assertInvoiceConfiguration,
  interruptionCode,
  invoiceRunFailure,
  type InvoiceRunResult,
} from './invoice-schedule-policy';
import {
  claimInvoiceRun,
  findActiveInvoiceFlow,
  finishInvoiceRun,
  invoiceFlowCode,
  readInvoiceRunStatus,
} from './invoice-schedule-state';
import { OneCInvoicePeriodImportService } from './one-c-invoice-period-import.service';

@Injectable()
export class OneCInvoiceSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: OneCInvoicePeriodImportService,
  ) {}

  status(code: string, actor: string) {
    return this.prisma.$transaction((tx) =>
      readInvoiceRunStatus(tx, code, actor),
    );
  }

  async run(sourceId: string, signal: AbortSignal, now = new Date()) {
    return this.prisma.$transaction(
      async (owner) => {
        const key = JSON.stringify([
          'warehouse:invoice-schedule',
          sourceId,
          invoiceFlowCode,
        ]);
        const [lock] = await owner.$queryRaw<
          { acquired: boolean; pid: number }[]
        >`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${key},0)) AS acquired, pg_backend_pid() AS pid`;
        if (!lock.acquired || signal.aborted) return;
        const claimed = await this.prisma.$transaction((tx) =>
          claimInvoiceRun(tx, sourceId, now, key, lock.pid),
        );
        if (!claimed) return;
        const { run, state, flow, schedule } = claimed;
        const deadline = AbortSignal.timeout(240_000);
        const runSignal = AbortSignal.any([signal, deadline]);
        const assertCurrent = async () =>
          assertInvoiceConfiguration(
            await findActiveInvoiceFlow(owner, sourceId),
            state.configurationHash,
          );
        let result: InvoiceRunResult;
        try {
          result = await importScheduledInvoiceWindow(
            this.importer,
            flow.source.code,
            run.periodFrom,
            run.periodTo,
            schedule.format,
            runSignal,
            assertCurrent,
          );
        } catch (error) {
          result = invoiceRunFailure(error, signal, deadline);
        }
        await owner.$queryRaw`SELECT id FROM integration_sources WHERE id=${sourceId}::uuid FOR UPDATE`;
        try {
          await assertCurrent();
        } catch (error) {
          if (!(error instanceof IntegrationFailure)) throw error;
          result = { ...result, outcome: 'FAILED', errorCode: error.code };
        }
        const interruption = interruptionCode(signal, deadline);
        if (interruption)
          result = { ...result, outcome: 'FAILED', errorCode: interruption };
        await finishInvoiceRun(owner, state, run.id, result);
      },
      { timeout: 330_000 },
    );
  }
}
