import { CalendarSource } from '@prisma/client';
import type { AuditLogService } from '../audit/audit-log.service';
import type { CalendarRepository } from './calendar.repository';
import {
  calendarRecord,
  createMockCalendarRepository,
} from './calendar-test.fixtures';
import { CalendarWorkdayWriterService } from './calendar.workday-writer.service';

describe('CalendarWorkdayWriterService', () => {
  function createTestContext() {
    const auditLog = {
      writeFieldChanges: jest.fn(),
    };
    const repository = createMockCalendarRepository();
    const writer = new CalendarWorkdayWriterService(
      auditLog as unknown as AuditLogService,
      repository as unknown as CalendarRepository,
    );

    return { auditLog, repository, writer };
  }

  it('sets working hours to zero when day becomes non-working', async () => {
    const { auditLog, repository, writer } = createTestContext();
    const current = calendarRecord('2026-08-03');
    const updated = calendarRecord('2026-08-03', {
      isWorkingDay: false,
      workingHours: 0,
    });

    repository.findDay.mockResolvedValue(current);
    repository.updateWorkday.mockResolvedValue(updated);

    await writer.updateWorkday(
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        isWorkingDay: false,
      },
      'user-1',
    );

    const tx = getTransactionArg(repository);

    expect(repository.updateWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      expect.objectContaining({
        isWorkingDay: false,
        source: CalendarSource.MANUAL,
        workingHours: 0,
      }),
      tx,
    );
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStringId: '2026-08-03',
        entityType: 'calendar_workday',
        fields: [
          {
            fieldName: 'Рабочий день',
            newValue: false,
            oldValue: true,
          },
          {
            fieldName: 'Рабочие часы',
            newValue: 0,
            oldValue: 8,
          },
        ],
        tx,
        userId: 'user-1',
      }),
    );
  });

  it('sets default working hours when day becomes working', async () => {
    const { repository, writer } = createTestContext();
    const current = calendarRecord('2026-08-01', {
      dayOfWeek: 6,
      isWorkingDay: false,
      workingHours: 0,
    });
    const updated = calendarRecord('2026-08-01');

    repository.findDay.mockResolvedValue(current);
    repository.updateWorkday.mockResolvedValue(updated);

    await writer.updateWorkday(
      {
        date: new Date('2026-08-01T00:00:00.000Z'),
        isWorkingDay: true,
      },
      'user-1',
    );

    expect(repository.updateWorkday).toHaveBeenCalledWith(
      new Date('2026-08-01T00:00:00.000Z'),
      expect.objectContaining({
        isWorkingDay: true,
        source: CalendarSource.MANUAL,
        workingHours: 8,
      }),
      getTransactionArg(repository),
    );
  });

  it('keeps explicitly provided working hours for working day', async () => {
    const { repository, writer } = createTestContext();
    const current = calendarRecord('2026-08-03');
    const updated = calendarRecord('2026-08-03', {
      workingHours: 6,
    });

    repository.findDay.mockResolvedValue(current);
    repository.updateWorkday.mockResolvedValue(updated);

    await writer.updateWorkday(
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        isWorkingDay: true,
        workingHours: 6,
      },
      'user-1',
    );

    expect(repository.updateWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      expect.objectContaining({
        isWorkingDay: true,
        source: CalendarSource.MANUAL,
        workingHours: 6,
      }),
      getTransactionArg(repository),
    );
  });

  it('keeps explicitly provided source for infrastructure updates', async () => {
    const { repository, writer } = createTestContext();
    const current = calendarRecord('2026-08-03');
    const updated = calendarRecord('2026-08-03', {
      source: CalendarSource.IMPORT,
      workingHours: 6,
    });

    repository.findDay.mockResolvedValue(current);
    repository.updateWorkday.mockResolvedValue(updated);

    await writer.updateWorkday(
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        isWorkingDay: true,
        source: CalendarSource.IMPORT,
        workingHours: 6,
      },
      null,
    );

    expect(repository.updateWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      expect.objectContaining({
        source: CalendarSource.IMPORT,
        workingHours: 6,
      }),
      getTransactionArg(repository),
    );
  });

  it('rejects non-working day with positive final working hours', async () => {
    const { repository, writer } = createTestContext();

    repository.findDay.mockResolvedValue(calendarRecord('2026-08-01'));

    await expect(
      writer.updateWorkday({
        date: new Date('2026-08-01T00:00:00.000Z'),
        isWorkingDay: false,
        workingHours: 8,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'WORKING_HOURS_INVALID',
        message: 'Для нерабочего дня продолжительность должна быть 0.',
      },
    });
  });
});

function getTransactionArg(
  repository: ReturnType<typeof createMockCalendarRepository>,
) {
  return repository.findDay.mock.calls[0]?.[1];
}
