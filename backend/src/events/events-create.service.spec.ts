import { BadRequestException } from '@nestjs/common';
import { EventSource, EventStatus } from '@prisma/client';
import {
  createCommand,
  createTx,
  createService,
} from './events-create.spec-fixtures';

describe('EventsCreateService service', () => {
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
});
