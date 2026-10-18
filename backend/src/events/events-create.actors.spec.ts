import { EventSource, EventStatus } from '@prisma/client';
import {
  createCommand,
  createTx,
  createService,
} from './events-create.spec-fixtures';

describe('EventsCreateService actors', () => {
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
});
