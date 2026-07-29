import { BadRequestException } from '@nestjs/common';
import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import { EventsCreateService } from './events-create.service';

describe('EventsCreateService', () => {
  type MockTransaction = ReturnType<typeof createTx>;
  type TransactionCallback = (tx: MockTransaction) => Promise<number>;

  function createCommand(overrides = {}) {
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

  function createTx() {
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

  function createService() {
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
      service: new EventsCreateService(accessAssertions, prisma as never),
    };
  }

  it('creates standalone event without extension', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();

    await expect(
      service.createInTransaction(
        tx as never,
        createCommand(),
        {
          kind: 'user',
          userId: 'user-1',
        },
        {},
      ),
    ).resolves.toBe(10);

    expect(accessAssertions.getCurrentEmployeeId).toHaveBeenCalledWith(
      tx,
      'user-1',
    );
    expect(tx.event.create).toHaveBeenCalledTimes(1);
    expect(tx.event.create).toHaveBeenCalledWith({
      data: {
        createdByEmployeeId: 5,
        extensionCode: null,
        factDate: null,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Standalone event',
      },
      select: {
        id: true,
      },
    });
    expect(tx.eventResponsible.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: 10,
          userId: 'user-1',
        },
      ],
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('wraps public create in transaction', async () => {
    const { prisma, service } = createService();

    await expect(
      service.create(createCommand(), {
        kind: 'user',
        userId: 'user-1',
      }),
    ).resolves.toBe(10);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('creates event with extension callback and passes event id', async () => {
    const { service } = createService();
    const tx = createTx();
    const createExtension = jest.fn().mockResolvedValue(undefined);

    await service.createInTransaction(
      tx as never,
      createCommand({
        extensionCode: EventExtensionCode.EQUIPMENT,
      }),
      {
        kind: 'user',
        userId: 'user-1',
      },
      {
        createExtension,
      },
    );

    expect(createExtension).toHaveBeenCalledWith({
      eventId: 10,
      tx,
    });
  });

  it('passes extension context to checklist and after-create callbacks', async () => {
    const { service } = createService();
    const tx = createTx();
    const extensionContext = { maintenanceSettingId: 50 };
    const afterCreate = jest.fn();
    const createChecklists = jest.fn();
    const createExtension = jest.fn().mockResolvedValue(extensionContext);

    await service.createInTransaction(
      tx as never,
      createCommand({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 10,
          },
        ],
        extensionCode: EventExtensionCode.EQUIPMENT,
      }),
      {
        kind: 'user',
        userId: 'user-1',
      },
      {
        afterCreate,
        createChecklists,
        createExtension,
      },
    );

    expect(createChecklists).toHaveBeenCalledWith({
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 10,
        },
      ],
      createdBy: 'user-1',
      eventId: 10,
      extensionContext,
      tx,
    });
    expect(afterCreate).toHaveBeenCalledWith({
      eventId: 10,
      extensionContext,
      tx,
    });
  });

  it('rejects extension callback for standalone event', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();

    await expect(
      service.createInTransaction(
        tx as never,
        createCommand(),
        {
          kind: 'user',
          userId: 'user-1',
        },
        {
          createExtension: jest.fn(),
        },
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_EXTENSION_UNEXPECTED',
      },
    });

    expect(accessAssertions.getCurrentEmployeeId).not.toHaveBeenCalled();
    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it('rejects extension event without extension callback', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();

    await expect(
      service.createInTransaction(
        tx as never,
        createCommand({
          extensionCode: EventExtensionCode.EQUIPMENT,
        }),
        {
          kind: 'user',
          userId: 'user-1',
        },
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_EXTENSION_REQUIRED',
      },
    });

    expect(accessAssertions.getCurrentEmployeeId).not.toHaveBeenCalled();
    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it('rejects checklist assignments without checklist callback', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();

    await expect(
      service.createInTransaction(
        tx as never,
        createCommand({
          checklistAssignments: [
            {
              assignedUserId: 'user-1',
              checklistTemplateId: 10,
            },
          ],
        }),
        {
          kind: 'user',
          userId: 'user-1',
        },
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'EVENT_CHECKLIST_CREATOR_REQUIRED',
      },
    });

    expect(accessAssertions.getCurrentEmployeeId).not.toHaveBeenCalled();
    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it('removes duplicate responsible ids', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();

    await service.createInTransaction(
      tx as never,
      createCommand({
        responsibleUserIds: ['user-1', 'user-1', 'user-2'],
      }),
      {
        kind: 'user',
        userId: 'user-1',
      },
    );

    expect(accessAssertions.assertResponsibleUsersExist).toHaveBeenCalledWith(
      tx,
      ['user-1', 'user-2'],
    );
    expect(tx.eventResponsible.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: 10,
          userId: 'user-1',
        },
        {
          eventId: 10,
          userId: 'user-2',
        },
      ],
    });
  });

  it('does not create responsible rows when responsible list is empty', async () => {
    const { service } = createService();
    const tx = createTx();

    await service.createInTransaction(
      tx as never,
      createCommand({
        responsibleUserIds: [],
      }),
      {
        kind: 'user',
        userId: 'user-1',
      },
    );

    expect(tx.eventResponsible.createMany).not.toHaveBeenCalled();
  });

  it('does not call checklist callback when assignments are empty', async () => {
    const { service } = createService();
    const tx = createTx();
    const createChecklists = jest.fn();

    await service.createInTransaction(
      tx as never,
      createCommand(),
      {
        kind: 'user',
        userId: 'user-1',
      },
      {
        createChecklists,
      },
    );

    expect(createChecklists).not.toHaveBeenCalled();
  });

  it('rejects missing responsible user', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();
    accessAssertions.assertResponsibleUsersExist.mockRejectedValue(
      new BadRequestException({
        code: 'RESPONSIBLE_USER_INACTIVE',
        message: 'Один или несколько ответственных не найдены или отключены.',
      }),
    );

    await expect(
      service.createInTransaction(tx as never, createCommand(), {
        kind: 'user',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'RESPONSIBLE_USER_INACTIVE',
      },
    });

    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it('creates event for valid system actor with null audit user', async () => {
    const { accessAssertions, service } = createService();
    const tx = createTx();
    accessAssertions.getCurrentEmployeeId.mockResolvedValue(6);

    await service.createInTransaction(tx as never, createCommand(), {
      employeeId: 6,
      kind: 'system',
      userId: 'system-user',
    });

    expect(tx.event.create).toHaveBeenCalledWith({
      data: {
        createdByEmployeeId: 6,
        extensionCode: null,
        factDate: null,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        source: EventSource.MANUAL,
        status: EventStatus.CREATED,
        title: 'Standalone event',
      },
      select: {
        id: true,
      },
    });
    const auditLogCreateMany = tx.auditLog.createMany as jest.MockedFunction<
      (args: { data: Array<{ userId: string | null }> }) => void
    >;
    const auditArgs = auditLogCreateMany.mock.calls[0]?.[0];

    expect(auditArgs?.data.every((item) => item.userId === null)).toBe(true);
  });

  it('rejects system actor with mismatched employee id', async () => {
    const { service } = createService();
    const tx = createTx();

    await expect(
      service.createInTransaction(tx as never, createCommand(), {
        employeeId: 6,
        kind: 'system',
        userId: 'system-user',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SYSTEM_ACTOR_EMPLOYEE_MISMATCH',
      },
    });

    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it('stops creation flow when extension callback fails', async () => {
    const { prisma, service } = createService();
    const tx = createTx();
    const createExtension = jest
      .fn()
      .mockRejectedValue(new Error('extension failed'));
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(tx),
    );

    await expect(
      service.create(
        createCommand({
          extensionCode: EventExtensionCode.EQUIPMENT,
        }),
        { kind: 'user', userId: 'user-1' },
        {
          createExtension,
        },
      ),
    ).rejects.toThrow('extension failed');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.event.create).toHaveBeenCalledTimes(1);
    expect(tx.eventResponsible.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });

  it('creates checklists after extension', async () => {
    const { service } = createService();
    const tx = createTx();
    const calls: string[] = [];
    const extensionContext = { maintenanceSettingId: 50 };
    const createExtension = jest.fn().mockImplementation(() => {
      calls.push('extension');

      return extensionContext;
    });
    const createChecklists = jest.fn().mockImplementation(() => {
      calls.push('checklists');
    });

    await service.createInTransaction(
      tx as never,
      createCommand({
        checklistAssignments: [
          {
            assignedUserId: 'user-1',
            checklistTemplateId: 10,
          },
        ],
        extensionCode: EventExtensionCode.EQUIPMENT,
      }),
      {
        kind: 'user',
        userId: 'user-1',
      },
      {
        createChecklists,
        createExtension,
      },
    );

    expect(calls).toEqual(['extension', 'checklists']);
    expect(createChecklists).toHaveBeenCalledWith({
      assignments: [
        {
          assignedUserId: 'user-1',
          checklistTemplateId: 10,
        },
      ],
      createdBy: 'user-1',
      eventId: 10,
      extensionContext,
      tx,
    });
  });
});
