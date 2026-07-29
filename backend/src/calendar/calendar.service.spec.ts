import type { CalendarRepository } from './calendar.repository';
import { CalendarService } from './calendar.service';
import { CALENDAR_EXPECTED_DAYS } from './calendar.constants';
import {
  calendarRecord,
  calendarRecordWithoutWorkday,
  createMockCalendarRepository,
} from './calendar-test.fixtures';
import type { CalendarWorkdayWriterService } from './calendar.workday-writer.service';

describe('CalendarService', () => {
  function createTestContext() {
    const repository = createMockCalendarRepository();
    const workdayWriter = {
      updateWorkday: jest.fn(),
    };
    const service = new CalendarService(
      repository as unknown as CalendarRepository,
      workdayWriter as unknown as CalendarWorkdayWriterService,
    );

    return { repository, service, workdayWriter };
  }

  it('returns calendar day response', async () => {
    const { repository, service } = createTestContext();

    repository.findDay.mockResolvedValue(calendarRecord('2026-08-03'));

    await expect(
      service.getDay(new Date('2026-08-03T00:00:00.000Z')),
    ).resolves.toMatchObject({
      date: '2026-08-03',
      dayOfWeek: 1,
      isWorkingDay: true,
      workingHours: 8,
    });
  });

  it('reports damaged calendar when day is missing', async () => {
    const { repository, service } = createTestContext();

    repository.findDay.mockResolvedValue(null);

    await expect(
      service.getDay(new Date('2026-08-03T00:00:00.000Z')),
    ).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_DAMAGED',
        message: 'Календарь поврежден.',
      },
    });
  });

  it('returns calendar range response', async () => {
    const { repository, service } = createTestContext();

    repository.findRange.mockResolvedValue([
      calendarRecord('2026-08-03'),
      calendarRecord('2026-08-04', { dayOfWeek: 2 }),
    ]);

    await expect(
      service.getRange(
        new Date('2026-08-03T00:00:00.000Z'),
        new Date('2026-08-04T00:00:00.000Z'),
      ),
    ).resolves.toEqual({
      days: [
        expect.objectContaining({
          date: '2026-08-03',
          isWorkingDay: true,
          workingHours: 8,
        }),
        expect.objectContaining({
          date: '2026-08-04',
          dayOfWeek: 2,
          isWorkingDay: true,
          workingHours: 8,
        }),
      ],
    });
  });

  it('reports damaged calendar when range has no records', async () => {
    const { repository, service } = createTestContext();

    repository.findRange.mockResolvedValue([]);

    await expect(
      service.getRange(
        new Date('2026-08-03T00:00:00.000Z'),
        new Date('2026-08-04T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_DAMAGED',
        message: 'Календарь поврежден.',
      },
    });
  });

  it('reports damaged calendar when range contains day without workday', async () => {
    const { repository, service } = createTestContext();

    repository.findRange.mockResolvedValue([
      calendarRecord('2026-08-03'),
      calendarRecordWithoutWorkday('2026-08-04'),
    ]);

    await expect(
      service.getRange(
        new Date('2026-08-03T00:00:00.000Z'),
        new Date('2026-08-04T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_DAMAGED',
        message: 'Календарь поврежден.',
      },
    });
  });

  it('delegates workday updates to writer', async () => {
    const { service, workdayWriter } = createTestContext();
    const update = {
      date: new Date('2026-08-03T00:00:00.000Z'),
      isWorkingDay: false,
    };

    workdayWriter.updateWorkday.mockResolvedValue(
      expect.objectContaining({ date: '2026-08-03' }),
    );

    await service.updateWorkday(update, 'user-1');

    expect(workdayWriter.updateWorkday).toHaveBeenCalledWith(update, 'user-1');
  });

  it('reports damaged calendar from integrity check', async () => {
    const { repository, service } = createTestContext();

    repository.validateIntegrity.mockResolvedValue({
      dateDuplicates: 0,
      expectedDays: CALENDAR_EXPECTED_DAYS,
      holes: [new Date('2026-08-03T00:00:00.000Z')],
      isValid: false,
      missingWorkdays: 0,
      orphanWorkdays: 0,
      totalDays: CALENDAR_EXPECTED_DAYS - 1,
      totalWorkdays: CALENDAR_EXPECTED_DAYS - 1,
    });

    await expect(service.assertIntegrity()).rejects.toMatchObject({
      response: {
        code: 'CALENDAR_DAMAGED',
        message: 'Календарь поврежден.',
      },
    });
  });
});
