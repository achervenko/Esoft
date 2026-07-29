import {
  AuditAction,
  AuditModule,
  ChecklistStatus,
  EventSource,
  EventStatus,
} from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { EventsLifecycleService } from './events-lifecycle.service';

describe('EventsLifecycleService', () => {
  function createAuditEvent(overrides = {}) {
    return {
      factDate: null,
      id: 1,
      note: null,
      originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibles: [],
      source: EventSource.MANUAL,
      status: EventStatus.CREATED,
      title: 'Event',
      ...overrides,
    };
  }

  function createEventState(overrides = {}) {
    return {
      factDate: null,
      id: 1,
      status: EventStatus.CREATED,
      version: 1,
      ...overrides,
    };
  }

  function createTx(params: { auditEvents?: unknown[] } = {}) {
    const auditEvents = params.auditEvents ?? [
      createAuditEvent({
        status: EventStatus.IN_PROGRESS,
      }),
    ];

    return {
      auditLog: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      event: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve(auditEvents.shift())),
      },
    };
  }

  function createService(tx = createTx()) {
    const checklistEventCompletionService = {
      cancelActiveChecklistsForCancelledEvent: jest.fn(),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const repository = {
      hasIncompleteChecklists: jest.fn().mockResolvedValue(false),
      loadForUpdate: jest.fn().mockResolvedValue(createEventState()),
      lockActiveChecklists: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EventsLifecycleService(
      checklistEventCompletionService as never,
      prisma as never,
      repository as never,
    );

    return {
      checklistEventCompletionService,
      prisma,
      repository,
      service,
      tx,
    };
  }

  function firstAuditCreateData(tx: ReturnType<typeof createTx>) {
    const create = tx.auditLog.create as jest.MockedFunction<
      (params: { data: Record<string, unknown> }) => void
    >;

    return create.mock.calls[0]?.[0].data;
  }

  it('wraps public start in transaction', async () => {
    const tx = createTx();
    const { prisma, repository, service } = createService(tx);

    await expect(service.start(1, { version: 1 }, 'user-1')).resolves.toEqual({
      eventId: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(repository.updateStatus).toHaveBeenCalledTimes(1);
  });

  it('wraps public complete in transaction', async () => {
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          status: EventStatus.IN_PROGRESS,
        }),
        createAuditEvent({
          factDate: new Date('2026-08-02T00:00:00.000Z'),
          status: EventStatus.COMPLETED,
        }),
      ],
    });
    const { prisma, repository, service } = createService(tx);
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await expect(
      service.complete(1, { version: 1 }, 'user-1'),
    ).resolves.toEqual({
      eventId: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('wraps public cancel in transaction', async () => {
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          status: EventStatus.CANCELLED,
        }),
      ],
    });
    const { prisma, service } = createService(tx);

    await expect(service.cancel(1, { version: 1 }, 'user-1')).resolves.toEqual({
      eventId: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('starts CREATED event and writes status audit', async () => {
    const tx = createTx();
    const { repository, service } = createService();

    await service.startInTransaction(tx as never, 1, { version: 1 }, 'user-1');

    expect(repository.updateStatus).toHaveBeenCalledWith(tx, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      eventId: 1,
      expectedStatus: EventStatus.CREATED,
      expectedVersion: 1,
      status: EventStatus.IN_PROGRESS,
      conflictMessage: 'Событие в текущем статусе нельзя начать.',
    });
    expect(firstAuditCreateData(tx)).toMatchObject({
      action: AuditAction.STATUS_CHANGE,
      entityId: 1,
      entityType: 'event',
      module: AuditModule.EVENTS,
      newValue: EventStatus.IN_PROGRESS,
      oldValue: EventStatus.CREATED,
      userId: 'user-1',
    });
  });

  it('rejects start outside CREATED status', async () => {
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await expect(
      service.startInTransaction({} as never, 1, { version: 1 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_STATUS_CONFLICT',
      },
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects stale lifecycle version before update', async () => {
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        version: 2,
      }),
    );

    await expect(
      service.startInTransaction({} as never, 1, { version: 1 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_VERSION_CONFLICT',
      },
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('completes IN_PROGRESS event with supplied fact date', async () => {
    const factDate = new Date('2026-08-02T00:00:00.000Z');
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          factDate: null,
          status: EventStatus.IN_PROGRESS,
        }),
        createAuditEvent({
          factDate,
          status: EventStatus.COMPLETED,
        }),
      ],
    });
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await service.completeInTransaction(
      tx as never,
      1,
      {
        factDate,
        version: 1,
      },
      'user-1',
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(tx, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      data: {
        factDate,
      },
      eventId: 1,
      expectedStatus: EventStatus.IN_PROGRESS,
      expectedVersion: 1,
      status: EventStatus.COMPLETED,
      conflictMessage: 'Событие в текущем статусе нельзя завершить.',
    });
    expect(firstAuditCreateData(tx)).toMatchObject({
      newValue: EventStatus.COMPLETED,
      oldValue: EventStatus.IN_PROGRESS,
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('completes event with current event fact date when input fact date is not supplied', async () => {
    const factDate = new Date('2026-08-03T00:00:00.000Z');
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          factDate,
          status: EventStatus.IN_PROGRESS,
        }),
        createAuditEvent({
          factDate,
          status: EventStatus.COMPLETED,
        }),
      ],
    });
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        factDate,
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await service.completeInTransaction(
      tx as never,
      1,
      { version: 1 },
      'user-1',
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        data: {
          factDate,
        },
      }),
    );
  });

  it('completes event with business today when no fact date exists', async () => {
    const factDate = getBusinessTodayDate();
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          factDate: null,
          status: EventStatus.IN_PROGRESS,
        }),
        createAuditEvent({
          factDate,
          status: EventStatus.COMPLETED,
        }),
      ],
    });
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        factDate: null,
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await service.completeInTransaction(
      tx as never,
      1,
      { version: 1 },
      'user-1',
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        data: {
          factDate,
        },
      }),
    );
  });

  it('rejects complete when checklists are incomplete', async () => {
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.IN_PROGRESS,
      }),
    );
    repository.hasIncompleteChecklists.mockResolvedValue(true);

    await expect(
      service.completeInTransaction({} as never, 1, { version: 1 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_CHECKLISTS_INCOMPLETE',
      },
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('cancels CREATED event and cancels active checklists', async () => {
    const activeChecklists = [
      {
        id: 100,
        status: ChecklistStatus.CREATED,
      },
    ];
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          status: EventStatus.CANCELLED,
        }),
      ],
    });
    const { checklistEventCompletionService, repository, service } =
      createService();
    repository.lockActiveChecklists.mockResolvedValue(activeChecklists);

    await service.cancelInTransaction(tx as never, 1, { version: 1 }, 'user-1');

    expect(repository.updateStatus).toHaveBeenCalledWith(tx, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      eventId: 1,
      expectedStatus: EventStatus.CREATED,
      expectedVersion: 1,
      status: EventStatus.CANCELLED,
      conflictMessage: 'Событие в текущем статусе нельзя отменить.',
    });
    expect(
      checklistEventCompletionService.cancelActiveChecklistsForCancelledEvent,
    ).toHaveBeenCalledWith(tx, activeChecklists, 'user-1');
  });

  it('uses status conflict for internal cancel without version', async () => {
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          status: EventStatus.CANCELLED,
        }),
      ],
    });
    const { repository, service } = createService();

    await service.cancelInTransaction(tx as never, 1, {}, 'user-1');

    expect(repository.updateStatus).toHaveBeenCalledWith(tx, {
      conflictCode: 'EVENT_STATUS_CONFLICT',
      eventId: 1,
      expectedStatus: EventStatus.CREATED,
      expectedVersion: undefined,
      status: EventStatus.CANCELLED,
      conflictMessage: 'Событие в текущем статусе нельзя отменить.',
    });
  });

  it('cancels IN_PROGRESS event', async () => {
    const tx = createTx({
      auditEvents: [
        createAuditEvent({
          status: EventStatus.CANCELLED,
        }),
      ],
    });
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.IN_PROGRESS,
      }),
    );

    await service.cancelInTransaction(tx as never, 1, { version: 1 }, 'user-1');

    expect(repository.updateStatus).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        expectedStatus: EventStatus.IN_PROGRESS,
        status: EventStatus.CANCELLED,
      }),
    );
  });

  it('rejects cancel outside CREATED and IN_PROGRESS statuses', async () => {
    const { repository, service } = createService();
    repository.loadForUpdate.mockResolvedValue(
      createEventState({
        status: EventStatus.COMPLETED,
      }),
    );

    await expect(
      service.cancelInTransaction({} as never, 1, { version: 1 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_STATUS_CONFLICT',
      },
    });

    expect(repository.lockActiveChecklists).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });
});
