import { EventSource, EventStatus } from '@prisma/client';
import { EventsCreateService } from './events-create.service';

type MockTransaction = ReturnType<typeof createTx>;
export type TransactionCallback = (tx: MockTransaction) => Promise<number>;

export function createCommand(overrides = {}) {
  return {
    checklistAssignments: [],
    extensionCode: null,
    note: null,
    originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
    plannedDate: new Date('2026-08-01T00:00:00.000Z'),
    responsibleUserIds: ['user-1'],
    source: EventSource.MANUAL,
    title: 'Standalone event',
    ...overrides,
  };
}

export function createTx() {
  return {
    auditLog: {
      createMany: jest.fn(),
    },
    event: {
      create: jest.fn().mockResolvedValue({ id: 10 }),
      findUnique: jest.fn().mockResolvedValue({
        factDate: null,
        id: 10,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibles: [],
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Standalone event',
      }),
    },
    eventResponsible: {
      createMany: jest.fn(),
    },
  };
}

export function createService() {
  const accessAssertions = {
    assertResponsibleUsersExist: jest.fn().mockResolvedValue(undefined),
    getCurrentEmployeeId: jest.fn().mockResolvedValue(5),
  };
  const prisma = {
    $transaction: jest.fn((callback: TransactionCallback) =>
      callback(createTx()),
    ),
  };

  return {
    accessAssertions,
    prisma,
    service: new EventsCreateService(
      accessAssertions as unknown as ConstructorParameters<
        typeof EventsCreateService
      >[0],
      prisma as never,
    ),
  };
}
