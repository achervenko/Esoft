import {
  invoiceRetryDelay,
  nextInvoiceWindow,
  readInvoiceSchedule,
} from './invoice-schedule';
import { importScheduledInvoiceWindow } from './invoice-schedule-import';
import { IntegrationFailure } from '../../integrations/integration-errors';
import type { OneCInvoicePeriodImportService } from './one-c-invoice-period-import.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { OneCInvoiceScheduler } from './one-c-invoice-scheduler';
import type { OneCInvoiceSchedulerService } from './one-c-invoice-scheduler.service';
import { Logger } from '@nestjs/common';

describe('invoice schedule', () => {
  it('defaults to disabled and requires an unambiguous start when enabled', () => {
    expect(readInvoiceSchedule({}).enabled).toBe(false);
    expect(readInvoiceSchedule({}).intervalSeconds).toBe(30);
    expect(readInvoiceSchedule({ intervalSeconds: 10 }).intervalSeconds).toBe(
      10,
    );
    expect(readInvoiceSchedule({ intervalMinutes: 5 }).intervalSeconds).toBe(
      300,
    );
    expect(() => readInvoiceSchedule({ enabled: true })).toThrow(
      'FLOW_CONFIG_UNSUPPORTED',
    );
    expect(() =>
      readInvoiceSchedule({ initialFrom: '2026-02-30T08:00:00Z' }),
    ).toThrow('FLOW_CONFIG_UNSUPPORTED');
    expect(() => readInvoiceSchedule({ overlapMinutes: 61 })).toThrow(
      'FLOW_CONFIG_UNSUPPORTED',
    );
  });

  it('checks on a subminute cadence without starting another run while busy', async () => {
    jest.useFakeTimers();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = jest
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const scheduler = new OneCInvoiceScheduler(
      {
        integrationFlow: {
          findMany: jest.fn().mockResolvedValue([{ sourceId: 'source' }]),
        },
      } as unknown as PrismaService,
      { run } as unknown as OneCInvoiceSchedulerService,
    );
    try {
      scheduler.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(31_000);
      expect(run).toHaveBeenCalledTimes(1);
      release();
      await jest.advanceTimersByTimeAsync(1_000);
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      release();
      await scheduler.onModuleDestroy();
      jest.useRealTimers();
    }
  });

  it('dispatches other sources while one stays busy and frees a failed slot', async () => {
    jest.useFakeTimers();
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    let release!: () => void;
    let reject!: (error: Error) => void;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const failing = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const run = jest.fn(async (sourceId: string) => {
      if (sourceId === 'a') await slow;
      if (sourceId === 'b') await failing;
    });
    const scheduler = new OneCInvoiceScheduler(
      {
        integrationFlow: {
          findMany: jest
            .fn()
            .mockResolvedValue(
              ['a', 'b', 'c'].map((sourceId) => ({ sourceId })),
            ),
        },
      } as unknown as PrismaService,
      { run } as unknown as OneCInvoiceSchedulerService,
    );
    try {
      scheduler.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(31_000);
      expect(run.mock.calls.map(([sourceId]) => sourceId)).toEqual(['a', 'b']);
      reject(new Error('source failure'));
      await jest.advanceTimersByTimeAsync(1000);
      expect(run.mock.calls.map(([sourceId]) => sourceId)).toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await scheduler.onModuleDestroy();
      log.mockRestore();
      jest.useRealTimers();
    }
  });

  it('crosses Moscow midnight and overlaps the previous checkpoint', () => {
    const schedule = readInvoiceSchedule({
      enabled: true,
      initialFrom: '2026-11-18T23:30:00+03:00',
    });
    const now = new Date('2026-11-19T08:00:00+03:00');
    const first = nextInvoiceWindow(schedule, null, now)!;
    const next = nextInvoiceWindow(schedule, first.to, now)!;
    expect(
      [first.from, first.to, next.from, next.to].map(schedule.format),
    ).toEqual([
      '2026-11-18T23:30:00',
      '2026-11-19T00:30:00',
      '2026-11-19T00:15:00',
      '2026-11-19T01:15:00',
    ]);
    expect(
      nextInvoiceWindow(
        schedule,
        new Date('2026-11-19T07:55:00+03:00'),
        now,
      )?.to.toISOString(),
    ).toBe('2026-11-19T04:59:00.000Z');
  });

  it('caps retry delays at thirty minutes', () => {
    expect(
      [1, 2, 3, 6, 20].map((attempt) => invoiceRetryDelay(attempt) / 60_000),
    ).toEqual([1, 2, 4, 30, 30]);
  });

  it.each(['ONE_C_INVOICES_RESPONSE_LIMIT', 'ONE_C_INVOICES_TIMEOUT'])(
    'splits a window after %s and confirms both halves',
    async (code) => {
      const importPeriod = jest
        .fn()
        .mockRejectedValueOnce(new IntegrationFailure(code, false))
        .mockResolvedValueOnce({ outcome: 'SUCCESS', documents: [] })
        .mockResolvedValueOnce({ outcome: 'FAILED', documents: [] });
      const schedule = readInvoiceSchedule({ timezone: 'UTC' });
      const result = await importScheduledInvoiceWindow(
        { importPeriod } as unknown as OneCInvoicePeriodImportService,
        '1c',
        new Date('2026-11-18T12:00:00Z'),
        new Date('2026-11-18T13:00:00Z'),
        schedule.format,
        new AbortController().signal,
        async () => {},
      );
      expect(result.outcome).toBe('FAILED');
      expect(
        importPeriod.mock.calls.map(([, period]: unknown[]) => period),
      ).toEqual([
        { dateFrom: '2026-11-18T12:00:00', dateTo: '2026-11-18T13:00:00' },
        { dateFrom: '2026-11-18T12:00:00', dateTo: '2026-11-18T12:30:00' },
        { dateFrom: '2026-11-18T12:30:00', dateTo: '2026-11-18T13:00:00' },
      ]);
    },
  );
});
