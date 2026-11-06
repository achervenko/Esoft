import { IntegrationSchedulerService } from './integration-scheduler.service';
import type { IntegrationWorkerService } from './integration-worker.service';
import { Logger } from '@nestjs/common';
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('logs cleanup failures but drains the queue on every tick', async () => {
  const log = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  const worker = {
    cleanupSkipped: jest.fn().mockRejectedValue(new Error('cleanup failed')),
    drain: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = new IntegrationSchedulerService(
    worker as unknown as IntegrationWorkerService,
  );
  scheduler.onApplicationBootstrap();
  await jest.advanceTimersByTimeAsync(10000);
  expect(worker.cleanupSkipped).toHaveBeenCalledTimes(2);
  expect(worker.drain).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledWith(
    'Не удалось очистить старые пропущенные события интеграций.',
  );
  await scheduler.onModuleDestroy();
  expect(jest.getTimerCount()).toBe(0);
});
it('logs drain failures separately and continues scheduling', async () => {
  const log = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  const worker = {
    cleanupSkipped: jest.fn().mockResolvedValue(undefined),
    drain: jest
      .fn()
      .mockRejectedValueOnce(new Error('drain failed'))
      .mockResolvedValue(undefined),
  };
  const scheduler = new IntegrationSchedulerService(
    worker as unknown as IntegrationWorkerService,
  );
  scheduler.onApplicationBootstrap();
  await jest.advanceTimersByTimeAsync(10000);
  expect(worker.drain).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(
    'Не удалось обработать очередь интеграций. Проверьте доступность БД.',
  );
  await scheduler.onModuleDestroy();
});
it('starts one scheduler, prevents overlap and waits for the in-flight drain on shutdown', async () => {
  let done!: () => void;
  const promise = new Promise<void>((resolve) => {
    done = resolve;
  });
  const worker = {
    cleanupSkipped: jest.fn().mockResolvedValue(undefined),
    drain: jest.fn<Promise<void>, [() => boolean]>().mockReturnValue(promise),
  };
  const scheduler = new IntegrationSchedulerService(
    worker as unknown as IntegrationWorkerService,
  );
  scheduler.onApplicationBootstrap();
  await jest.advanceTimersByTimeAsync(15000);
  expect(worker.drain).toHaveBeenCalledTimes(1);
  let stopped = false;
  const shutdown = scheduler.onModuleDestroy().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  expect(stopped).toBe(false);
  expect(worker.drain.mock.calls[0][0]()).toBe(false);
  done();
  await shutdown;
  await jest.advanceTimersByTimeAsync(10000);
  expect(worker.drain).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it('continues scheduling after a completed drain', async () => {
  const worker = {
    cleanupSkipped: jest.fn().mockResolvedValue(undefined),
    drain: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = new IntegrationSchedulerService(
    worker as unknown as IntegrationWorkerService,
  );
  scheduler.onApplicationBootstrap();
  await jest.advanceTimersByTimeAsync(10000);
  expect(worker.drain).toHaveBeenCalledTimes(2);
  await scheduler.onModuleDestroy();
  expect(jest.getTimerCount()).toBe(0);
});
