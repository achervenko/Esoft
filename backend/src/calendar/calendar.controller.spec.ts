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
    };
    const sourceResolver = {
      resolveProviders: jest.fn().mockReturnValue(['provider']),
    };
    const controller = new CalendarController(
      calendarEngine,
      calendarService as never,
      sourceResolver,
    );
    const session = {
      user: {
        id: 'user-1',
        role: 'engineer',
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

  it('returns calendar engine dto through read-only endpoint', async () => {
    const { calendarEngine, controller, session, sourceResolver } =
      createController();

    await expect(
      controller.findCalendar(
        {
          from: '2026-08-01',
          to: '2026-08-31',
        },
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

  it('keeps administrative calendar endpoints protected for admin only', () => {
    const { calendarService, controller, session } = createController();

    expect(
      getThrownResponse(() =>
        controller.findRange(
          {
            dateFrom: '2026-08-01',
            dateTo: '2026-08-02',
          },
          session as never,
        ),
      ),
    ).toEqual({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для работы с календарем.',
    });
    expect(calendarService.getRange).not.toHaveBeenCalled();
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
