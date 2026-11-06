import { IntegrationFailure } from './integration-errors';
import { IntegrationWorkerService } from './integration-worker.service';
import { IntegrationRegistry } from './integration-registry';
import type { PrismaService } from '../prisma/prisma.service';
afterEach(() => jest.useRealTimers());
it.each([true, false])(
  'renews a running lease and only acknowledges ownership (%s)',
  async (owned) => {
    jest.useFakeTimers();
    const registry = new IntegrationRegistry();
    registry.registerAdapter({
      systemType: 'TEST',
      validateSourceConfig() {},
      createHttpClient() {
        return { getJson: jest.fn() };
      },
    });
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    registry.registerFlow({
      flowCode: 'test.flow',
      name: 'Test',
      owner: 'test',
      systemTypes: ['TEST'],
      configVersions: [1],
      incomingActions: ['event:create'],
      validateConfig() {},
      validateEvent() {},
      handle: () => pending,
    });
    const event = {
      id: 1n,
      leaseToken: 'token',
      eventId: 'event',
      objectId: '1',
      type: 'UPDATE',
      version: '1',
      flowCode: 'test.flow',
      flow: {
        configVersion: 1,
        config: {},
        source: { systemType: 'TEST', code: 'source', actorUserId: 'actor' },
      },
    };
    const worker = new IntegrationWorkerService(
      {
        integrationEvent: { findUnique: jest.fn().mockResolvedValue(event) },
      } as unknown as PrismaService,
      registry,
    );
    jest.spyOn(worker, 'claim').mockResolvedValue(event as never);
    const renewal = jest.spyOn(worker, 'renew').mockResolvedValue(owned);
    const finish = jest.spyOn(worker, 'finish').mockResolvedValue(true);
    const processing = worker.process(1n);
    await jest.advanceTimersByTimeAsync(15000);
    expect(renewal).toHaveBeenCalledWith(1n, 'token');
    resolve();
    await processing;
    expect(finish).toHaveBeenCalledTimes(owned ? 1 : 0);
    expect(jest.getTimerCount()).toBe(0);
  },
);

it.each([false, true])(
  'validates handler, adapter and config from the claimed event (invalid=%s)',
  async (invalid) => {
    const registry = new IntegrationRegistry();
    const oldHandle = jest.fn().mockResolvedValue(undefined);
    const getJson = jest.fn().mockResolvedValue({});
    const oldClient = jest.fn(() => ({ getJson }));
    const newClient = jest.fn(() => ({ getJson }));
    registry.registerAdapter({
      systemType: 'OLD',
      validateSourceConfig() {},
      createHttpClient: oldClient,
    });
    registry.registerAdapter({
      systemType: 'NEW',
      validateSourceConfig() {},
      createHttpClient: newClient,
    });
    registry.registerFlow({
      flowCode: 'test.old',
      name: 'Old',
      owner: 'test',
      systemTypes: ['OLD'],
      configVersions: [1],
      incomingActions: ['event:create'],
      validateConfig() {},
      validateEvent() {},
      handle: oldHandle,
    });
    const validateConfig = jest.fn((_version: number, config: unknown) => {
      if (
        config &&
        typeof config === 'object' &&
        'invalid' in config &&
        config.invalid
      )
        throw new IntegrationFailure('TEST_CONFIG_INVALID', false);
    });
    const handle = jest.fn(
      async (
        context: import('./integration.contracts').IntegrationFlowContext,
      ) => {
        await context.client.getJson('document');
      },
    );
    registry.registerFlow({
      flowCode: 'test.new',
      name: 'New',
      owner: 'test',
      systemTypes: ['NEW'],
      configVersions: [2],
      incomingActions: ['event:create'],
      validateConfig,
      validateEvent() {},
      handle,
    });
    const candidate = {
      id: 1n,
      leaseToken: 'token',
      eventId: 'event',
      objectId: '1',
      type: 'UPDATE',
      version: '1',
      flowCode: 'test.old',
      flow: {
        configVersion: 1,
        config: {},
        source: { systemType: 'OLD', code: 'source', actorUserId: 'actor' },
      },
    };
    const claimed = {
      ...candidate,
      flowCode: 'test.new',
      flow: {
        configVersion: 2,
        config: { invalid },
        source: { ...candidate.flow.source, systemType: 'NEW' },
      },
    };
    const worker = new IntegrationWorkerService(
      {
        integrationEvent: {
          findUnique: jest.fn().mockResolvedValue(candidate),
        },
      } as unknown as PrismaService,
      registry,
    );
    jest.spyOn(worker, 'claim').mockResolvedValue(claimed as never);
    const finish = jest.spyOn(worker, 'finish').mockResolvedValue(true);
    await worker.process(1n);
    expect(validateConfig).toHaveBeenCalledWith(2, { invalid });
    expect(oldHandle).not.toHaveBeenCalled();
    expect(oldClient).not.toHaveBeenCalled();
    if (invalid) {
      expect(handle).not.toHaveBeenCalled();
      expect(finish).toHaveBeenCalledWith(1n, 'token', {
        code: 'TEST_CONFIG_INVALID',
        retryable: false,
      });
    } else {
      expect(handle).toHaveBeenCalledWith(
        expect.objectContaining({ configVersion: 2, config: { invalid } }),
      );
      expect(newClient).toHaveBeenCalledWith(claimed.flow.source);
      expect(getJson).toHaveBeenCalled();
      expect(finish).toHaveBeenCalledWith(1n, 'token');
    }
  },
);
