import { EventSource, EventStatus } from '@prisma/client';
import { EventsUpdateService } from './events-update.service';

describe('EventsUpdateService', () => {
  function createCurrentState(overrides = {}) {
    return {
      currentChecklists: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 10,
          id: 100,
          sortOrder: 1,
        },
      ],
      currentNote: null,
      currentPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      currentResponsibleUserIds: ['user-1'],
      currentTitle: 'Old title',
      version: 1,
      ...overrides,
    };
  }

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
      title: 'Old title',
      ...overrides,
    };
  }

  function createTx(
    params: {
      finalChecklists?: Array<{
        assignedUserId: string;
        id: number;
      }>;
      newAuditEvent?: Record<string, unknown>;
      oldAuditEvent?: Record<string, unknown>;
      updateCount?: number;
    } = {},
  ) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
      auditLog: {
        createMany: jest.fn(),
      },
      checklist: {
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue(
          params.finalChecklists ?? [
            {
              assignedUserId: 'user-1',
              id: 100,
            },
          ],
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      event: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(createAuditEvent(params.oldAuditEvent))
          .mockResolvedValueOnce(createAuditEvent(params.newAuditEvent)),
        updateMany: jest.fn().mockResolvedValue({
          count: params.updateCount ?? 1,
        }),
      },
      eventResponsible: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
  }

  function createService() {
    const inputLoader = {
      loadValidCreatedUpdateInput: jest.fn(),
    };
    const tx = createTx();
    const prisma = {
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new EventsUpdateService(
      inputLoader as never,
      prisma as never,
    );
    const checklistCreator = {
      createEventChecklists: jest.fn().mockResolvedValue([]),
    };

    return {
      checklistCreator,
      inputLoader,
      prisma,
      service,
      tx,
    };
  }

  it('wraps public update in transaction', async () => {
    const { checklistCreator, inputLoader, prisma, service, tx } =
      createService();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreated(
        checklistCreator,
        1,
        {
          title: 'New title',
          version: 1,
        },
        'user-1',
      ),
    ).resolves.toEqual({
      eventId: 1,
      updated: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.event.updateMany).toHaveBeenCalledTimes(1);
  });

  it('updates created event core fields and writes generic audit', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx({
      newAuditEvent: {
        title: 'New title',
      },
    });
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          title: 'New title',
          version: 1,
        },
        'user-1',
      ),
    ).resolves.toEqual({
      eventId: 1,
      updated: true,
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: EventStatus.CREATED,
        version: 1,
      },
      data: {
        title: 'New title',
        version: {
          increment: 1,
        },
      },
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects stale version before updating event', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState({
        version: 2,
      }),
    );

    await expect(
      service.updateCreatedInTransaction(tx as never, checklistCreator, 1, {
        title: 'New title',
        version: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_VERSION_CONFLICT',
      },
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('returns conflict when optimistic update affects no rows', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx({ updateCount: 0 });
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          title: 'New title',
          version: 1,
        },
        'user-1',
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_VERSION_CONFLICT',
      },
    });

    expect(tx.eventResponsible.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it('resolves extension options after loading current event and updates extension', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    const calls: string[] = [];
    inputLoader.loadValidCreatedUpdateInput.mockImplementation(() => {
      calls.push('load');
      return createCurrentState();
    });
    const updateExtension = jest.fn().mockImplementation(() => {
      calls.push('extension');
    });

    await service.updateCreatedInTransaction(
      tx as never,
      checklistCreator,
      1,
      {
        version: 1,
      },
      'user-1',
      () => {
        calls.push('resolve');

        return Promise.resolve({
          hasExtensionChanges: true,
          updateExtension,
        });
      },
    );

    expect(calls).toEqual(['load', 'resolve', 'extension']);
    expect(updateExtension).toHaveBeenCalledWith({
      eventId: 1,
      tx,
    });
  });

  it('requires full checklist assignments when extension requires them', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          version: 1,
        },
        'user-1',
        () =>
          Promise.resolve({
            requiresChecklistAssignments: true,
          }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'CHECKLIST_ASSIGNMENTS_REQUIRED',
      },
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('validates explicitly supplied checklist assignments', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx({
      finalChecklists: [
        {
          assignedUserId: 'user-1',
          id: 100,
        },
      ],
    });
    const validateChecklists = jest.fn().mockResolvedValue(undefined);
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await service.updateCreatedInTransaction(
      tx as never,
      checklistCreator,
      1,
      {
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 11,
          },
        ],
        version: 1,
      },
      'user-1',
      () =>
        Promise.resolve({
          validateChecklists,
        }),
    );

    expect(validateChecklists).toHaveBeenCalledWith({
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 11,
        },
      ],
      tx,
    });
  });

  it('does not validate current checklist assignments when assignments were not supplied', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx({
      newAuditEvent: {
        title: 'New title',
      },
    });
    const validateChecklists = jest.fn();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await service.updateCreatedInTransaction(
      tx as never,
      checklistCreator,
      1,
      {
        title: 'New title',
        version: 1,
      },
      'user-1',
      () =>
        Promise.resolve({
          validateChecklists,
        }),
    );

    expect(validateChecklists).not.toHaveBeenCalled();
  });

  it('does not invoke extension update when extension has no changes', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          version: 1,
        },
        'user-1',
        () =>
          Promise.resolve({
            hasExtensionChanges: false,
            requiresChecklistAssignments: false,
          }),
      ),
    ).resolves.toEqual({
      eventId: 1,
      updated: false,
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('rejects extension changes without update callback', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          version: 1,
        },
        'user-1',
        () =>
          Promise.resolve({
            hasExtensionChanges: true,
          }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_EXTENSION_UPDATE_REQUIRED',
      },
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('rejects extension update callback without extension changes', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(
        tx as never,
        checklistCreator,
        1,
        {
          version: 1,
        },
        'user-1',
        () =>
          Promise.resolve({
            updateExtension: jest.fn(),
          }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_EXTENSION_UPDATE_UNEXPECTED',
      },
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('updates responsible users when responsible set changes', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx({
      finalChecklists: [
        {
          assignedUserId: 'user-2',
          id: 101,
        },
      ],
    });
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await service.updateCreatedInTransaction(
      tx as never,
      checklistCreator,
      1,
      {
        checklistAssignments: [
          {
            assignedUserId: 'user-2',
            checklistTemplateId: 10,
          },
        ],
        responsibleUserIds: ['user-2'],
        version: 1,
      },
      'user-1',
    );

    expect(tx.eventResponsible.deleteMany).toHaveBeenCalledWith({
      where: { eventId: 1 },
    });
    expect(tx.eventResponsible.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: 1,
          userId: 'user-2',
        },
      ],
    });
  });

  it('returns event id without mutations when nothing changed', async () => {
    const { checklistCreator, inputLoader, service } = createService();
    const tx = createTx();
    inputLoader.loadValidCreatedUpdateInput.mockResolvedValue(
      createCurrentState(),
    );

    await expect(
      service.updateCreatedInTransaction(tx as never, checklistCreator, 1, {
        version: 1,
      }),
    ).resolves.toEqual({
      eventId: 1,
      updated: false,
    });

    expect(tx.event.updateMany).not.toHaveBeenCalled();
    expect(tx.eventResponsible.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });
});
