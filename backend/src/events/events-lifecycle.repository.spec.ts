import { EventStatus } from '@prisma/client';
import { EventsLifecycleRepository } from './events-lifecycle.repository';

describe('EventsLifecycleRepository', () => {
  function createRepository() {
    return new EventsLifecycleRepository();
  }

  it('locks event before loading lifecycle state', async () => {
    const repository = createRepository();
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn().mockImplementation(() => {
        calls.push('lock');
        return Promise.resolve([{ id: 1 }]);
      }),
      event: {
        findUnique: jest.fn().mockImplementation(() => {
          calls.push('load');
          return Promise.resolve({
            factDate: null,
            id: 1,
            status: EventStatus.CREATED,
            version: 1,
          });
        }),
      },
    };

    await expect(repository.loadForUpdate(tx as never, 1)).resolves.toEqual({
      factDate: null,
      id: 1,
      status: EventStatus.CREATED,
      version: 1,
    });
    expect(calls).toEqual(['lock', 'load']);
  });

  it('rejects missing event while locking', async () => {
    const repository = createRepository();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      repository.loadForUpdate(tx as never, 1),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });
  });

  it('updates status with optimistic version', async () => {
    const repository = createRepository();
    const tx = {
      event: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await repository.updateStatus(tx as never, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      eventId: 1,
      expectedStatus: EventStatus.CREATED,
      expectedVersion: 1,
      status: EventStatus.IN_PROGRESS,
      conflictMessage: 'conflict',
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: EventStatus.CREATED,
        version: 1,
      },
      data: {
        status: EventStatus.IN_PROGRESS,
        version: {
          increment: 1,
        },
      },
    });
  });

  it('updates status without optimistic version when version is not supplied', async () => {
    const repository = createRepository();
    const tx = {
      event: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await repository.updateStatus(tx as never, {
      conflictCode: 'EVENT_STATUS_CONFLICT',
      eventId: 1,
      expectedStatus: EventStatus.IN_PROGRESS,
      status: EventStatus.CANCELLED,
      conflictMessage: 'conflict',
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: EventStatus.IN_PROGRESS,
      },
      data: {
        status: EventStatus.CANCELLED,
        version: {
          increment: 1,
        },
      },
    });
  });

  it('updates status with additional event data', async () => {
    const repository = createRepository();
    const factDate = new Date('2026-08-01T00:00:00.000Z');
    const tx = {
      event: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await repository.updateStatus(tx as never, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      data: {
        factDate,
      },
      eventId: 1,
      expectedStatus: EventStatus.IN_PROGRESS,
      expectedVersion: 1,
      status: EventStatus.COMPLETED,
      conflictMessage: 'conflict',
    });

    expect(tx.event.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: EventStatus.IN_PROGRESS,
        version: 1,
      },
      data: {
        factDate,
        status: EventStatus.COMPLETED,
        version: {
          increment: 1,
        },
      },
    });
  });

  it('returns conflict when optimistic status update affects no rows', async () => {
    const repository = createRepository();
    const tx = {
      event: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      repository.updateStatus(tx as never, {
        conflictCode: 'EVENT_VERSION_CONFLICT',
        eventId: 1,
        expectedStatus: EventStatus.CREATED,
        expectedVersion: 1,
        status: EventStatus.IN_PROGRESS,
        conflictMessage: 'conflict',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_VERSION_CONFLICT',
      },
    });
  });

  it('returns status conflict when status-only update affects no rows', async () => {
    const repository = createRepository();
    const tx = {
      event: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      repository.updateStatus(tx as never, {
        conflictCode: 'EVENT_STATUS_CONFLICT',
        eventId: 1,
        expectedStatus: EventStatus.CREATED,
        status: EventStatus.CANCELLED,
        conflictMessage: 'conflict',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_STATUS_CONFLICT',
      },
    });
  });

  it('loads incomplete checklist state', async () => {
    const repository = createRepository();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ hasIncomplete: true }]),
    };

    await expect(
      repository.hasIncompleteChecklists(tx as never, 1),
    ).resolves.toBe(true);
  });

  it('returns false when incomplete checklist query returns no state', async () => {
    const repository = createRepository();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      repository.hasIncompleteChecklists(tx as never, 1),
    ).resolves.toBe(false);
  });
});
