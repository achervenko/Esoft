import { EquipmentEventsLifecycleService } from './equipment-events-lifecycle.service';

describe('EquipmentEventsLifecycleService', () => {
  type CancelInTransactionMock = jest.Mock<
    Promise<{ eventId: number }>,
    [
      transaction: Record<string, never>,
      eventId: number,
      data: Record<string, never>,
      userId: string | null | undefined,
      options: {
        assertScope: (
          transaction: Record<string, never>,
          eventId: number,
        ) => Promise<void>;
      },
    ]
  >;

  function createService() {
    const tx: Record<string, never> = {};

    const eventsLifecycleService = {
      cancelInTransaction: jest.fn().mockResolvedValue({
        eventId: 1,
      }) as CancelInTransactionMock,
    };

    const prisma = {
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    const stateAssertions = {
      assertEquipmentEventExists: jest.fn().mockResolvedValue(undefined),
    };

    const detailResponse = {
      id: 1,
    };

    const queryService = {
      findOne: jest.fn().mockResolvedValue(detailResponse),
    };

    const service = new EquipmentEventsLifecycleService(
      eventsLifecycleService as never,
      prisma as never,
      stateAssertions,
      queryService as never,
    );

    return {
      detailResponse,
      eventsLifecycleService,
      prisma,
      queryService,
      service,
      stateAssertions,
      tx,
    };
  }

  it('opens transaction and delegates cancel to generic lifecycle', async () => {
    const {
      detailResponse,
      eventsLifecycleService,
      prisma,
      queryService,
      service,
      tx,
    } = createService();

    await expect(service.cancel(1, 'user-1')).resolves.toBe(detailResponse);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(eventsLifecycleService.cancelInTransaction).toHaveBeenCalledWith(
      tx,
      1,
      {},
      'user-1',
      expect.objectContaining({
        assertScope: expect.any(Function) as unknown,
      }),
    );
    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  function invokeAssertScopeInCancel(): (
    transaction: Record<string, never>,
    eventId: number,
    data: Record<string, never>,
    userId: string | null | undefined,
    options: Parameters<CancelInTransactionMock>[4],
  ) => Promise<{ eventId: number }> {
    return async (transaction, eventId, _data, _userId, options) => {
      await options.assertScope(transaction, eventId);

      return { eventId };
    };
  }

  it('checks equipment scope inside generic lifecycle transaction', async () => {
    const { eventsLifecycleService, service, stateAssertions, tx } =
      createService();

    eventsLifecycleService.cancelInTransaction.mockImplementation(
      invokeAssertScopeInCancel(),
    );

    await service.cancel(1, 'user-1');

    expect(stateAssertions.assertEquipmentEventExists).toHaveBeenCalledWith(
      tx,
      1,
    );
  });

  it('returns compatibility detail by event id from generic lifecycle result', async () => {
    const { eventsLifecycleService, queryService, service } = createService();

    eventsLifecycleService.cancelInTransaction.mockResolvedValue({
      eventId: 25,
    });

    await service.cancel(1, 'user-1');

    expect(queryService.findOne).toHaveBeenCalledWith(25);
  });

  it('does not load compatibility detail when generic lifecycle fails', async () => {
    const { eventsLifecycleService, queryService, service } = createService();

    eventsLifecycleService.cancelInTransaction.mockRejectedValue(
      new Error('cancel failed'),
    );

    await expect(service.cancel(1, 'user-1')).rejects.toThrow('cancel failed');

    expect(queryService.findOne).not.toHaveBeenCalled();
  });

  it('does not load compatibility detail when equipment scope check fails', async () => {
    const { eventsLifecycleService, queryService, service, stateAssertions } =
      createService();

    stateAssertions.assertEquipmentEventExists.mockRejectedValue(
      new Error('equipment event not found'),
    );

    eventsLifecycleService.cancelInTransaction.mockImplementation(
      invokeAssertScopeInCancel(),
    );

    await expect(service.cancel(1, 'user-1')).rejects.toThrow(
      'equipment event not found',
    );

    expect(queryService.findOne).not.toHaveBeenCalled();
  });
});
