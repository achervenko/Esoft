jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import { CalendarController } from './calendar.controller';

type ExceptionResponse = {
  code: string;
  message: string;
};

describe('CalendarController', () => {
  function createController() {
    const calendarEngine = {
      buildCalendar: jest.fn().mockResolvedValue({ days: [], layers: [] }),
    };
    const calendarService = {
      getDay: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
      getRange: jest.fn().mockResolvedValue({ days: [] }),
      updateWorkday: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
      resetWorkday: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
    };
    const sourceResolver = {
      resolveProviders: jest.fn().mockReturnValue(['provider']),
    };
    const controller = new CalendarController(
      calendarEngine,
      calendarService as never,
      sourceResolver as unknown as ConstructorParameters<
        typeof CalendarController
      >[2],
    );
    const session = {
      user: {
        id: 'user-1',
      },
    };

    return {
      calendarEngine,
      calendarService,
      controller,
      session,
      sourceResolver,
    };
  }

  it('resolves permitted providers and forwards parsed range to calendar engine', async () => {
    const { calendarEngine, controller, session, sourceResolver } =
      createController();
    await expect(
      controller.findCalendar(
        { from: '2026-08-01', to: '2026-08-31' },
        session as never,
      ),
    ).resolves.toEqual({ days: [], layers: [] });
    expect(sourceResolver.resolveProviders).toHaveBeenCalledWith(session);
    expect(calendarEngine.buildCalendar).toHaveBeenCalledWith({
      dateFrom: new Date('2026-08-01T00:00:00.000Z'),
      dateTo: new Date('2026-08-31T00:00:00.000Z'),
      providers: ['provider'],
    });
  });

  it('forwards parsed workday changes and actor and rejects invalid dates', async () => {
    const { controller, calendarService, session } = createController();
    await controller.updateWorkday(
      { date: '2026-08-03', isWorkingDay: true },
      session as never,
    );
    expect(calendarService.updateWorkday).toHaveBeenCalledWith(
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        isWorkingDay: true,
      },
      'user-1',
    );
    calendarService.updateWorkday.mockClear();
    expect(
      getThrownResponse(() =>
        controller.updateWorkday(
          { date: 'not-a-date', isWorkingDay: true },
          session as never,
        ),
      ),
    ).toMatchObject({ code: 'DATE_INVALID' });
    expect(calendarService.updateWorkday).not.toHaveBeenCalled();
  });

  it('forwards reset date and actor and rejects invalid dates', async () => {
    const { controller, calendarService, session } = createController();
    await controller.resetWorkday({ date: '2026-08-03' }, session as never);
    expect(calendarService.resetWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      'user-1',
    );
    calendarService.resetWorkday.mockClear();
    expect(
      getThrownResponse(() =>
        controller.resetWorkday({ date: 'not-a-date' }, session as never),
      ),
    ).toMatchObject({ code: 'DATE_INVALID' });
    expect(calendarService.resetWorkday).not.toHaveBeenCalled();
  });
});

function getThrownResponse(action: () => unknown): ExceptionResponse {
  try {
    action();
  } catch (error) {
    return (error as { getResponse(): ExceptionResponse }).getResponse();
  }

  throw new Error('Expected action to throw.');
}
