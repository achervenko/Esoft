import { EventStatus } from '@prisma/client';
import { EventsUpdateInputLoader } from './events-update-input.loader';

describe('EventsUpdateInputLoader', () => {
  function createLoader() {
    const accessAssertions = {
      assertResponsibleUsersExist: jest.fn(),
    };
    const loader = new EventsUpdateInputLoader(accessAssertions as never);

    return { accessAssertions, loader };
  }

  function createEvent(overrides = {}) {
    return {
      checklists: [],
      note: null,
      plannedDate: new Date('2026-08-01T00:00:00.000Z'),
      responsibles: [
        {
          userId: 'user-1',
        },
      ],
      status: EventStatus.CREATED,
      title: 'Event',
      version: 1,
      ...overrides,
    };
  }

  it('rejects missing event before update', async () => {
    const { loader } = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    await expect(
      loader.loadValidCreatedUpdateInput(tx as never, {
        eventId: 404,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_NOT_FOUND',
      },
    });
  });

  it('locks event before loading current state', async () => {
    const { loader } = createLoader();
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn().mockImplementation(() => {
        calls.push('lock');
        return Promise.resolve([{ id: 1 }]);
      }),
      event: {
        findUnique: jest.fn().mockImplementation(() => {
          calls.push('load');
          return Promise.resolve(createEvent());
        }),
      },
    };

    await loader.loadValidCreatedUpdateInput(tx as never, {
      eventId: 1,
    });

    expect(calls).toEqual(['lock', 'load']);
  });

  it('rejects event outside CREATED status', async () => {
    const { loader } = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
      event: {
        findUnique: jest.fn().mockResolvedValue(
          createEvent({
            status: EventStatus.IN_PROGRESS,
          }),
        ),
      },
    };

    await expect(
      loader.loadValidCreatedUpdateInput(tx as never, {
        eventId: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_STATUS_CONFLICT',
      },
    });
  });

  it('does not validate responsible users when responsible set is not supplied', async () => {
    const { accessAssertions, loader } = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
      event: {
        findUnique: jest.fn().mockResolvedValue(createEvent()),
      },
    };

    await loader.loadValidCreatedUpdateInput(tx as never, {
      eventId: 1,
    });

    expect(accessAssertions.assertResponsibleUsersExist).not.toHaveBeenCalled();
  });

  it('returns current created event state', async () => {
    const { accessAssertions, loader } = createLoader();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
      event: {
        findUnique: jest.fn().mockResolvedValue(createEvent()),
      },
    };

    await expect(
      loader.loadValidCreatedUpdateInput(tx as never, {
        eventId: 1,
        responsibleUserIds: ['user-2'],
      }),
    ).resolves.toEqual({
      currentChecklists: [],
      currentNote: null,
      currentPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
      currentResponsibleUserIds: ['user-1'],
      currentTitle: 'Event',
      version: 1,
    });
    expect(accessAssertions.assertResponsibleUsersExist).toHaveBeenCalledWith(
      tx,
      ['user-2'],
    );
  });
});
