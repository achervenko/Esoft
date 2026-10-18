import { EventExtensionCode } from '@prisma/client';
import {
  createCommand,
  createTx,
  createService,
  type TransactionCallback,
} from './events-create.spec-fixtures';

describe('EventsCreateService extensions', () => {
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
