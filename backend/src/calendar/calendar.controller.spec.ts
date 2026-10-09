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

  it.each(['admin', 'chief_engineer', 'engineer'])(
    'returns calendar engine dto for %s through read-only endpoint',
    async (role) => {
      const { calendarEngine, controller, session, sourceResolver } =
        createController();
      session.user.role = role;

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
    },
  );

  it.each([
    'operator',
    'auditor',
    'ppe_specialist',
    'accounting_specialist',
    'unknown',
    null,
    undefined,
  ])('rejects calendar viewing for %s before resolving providers', (role) => {
    const { calendarEngine, controller, session, sourceResolver } =
      createController();
    expect(
      getThrownResponse(() =>
        controller.findCalendar({ from: '2026-08-01', to: '2026-08-31' }, {
          ...session,
          user: { ...session.user, role },
        } as never),
      ),
    ).toMatchObject({ code: 'FORBIDDEN' });
    expect(sourceResolver.resolveProviders).not.toHaveBeenCalled();
    expect(calendarEngine.buildCalendar).not.toHaveBeenCalled();
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

  it('resets a day only for an admin and forwards date and actor', async () => {
    const { controller, calendarService, session } = createController();
    expect(
      getThrownResponse(() =>
        controller.resetWorkday({ date: '2026-08-03' }, session as never),
      ),
    ).toMatchObject({ code: 'FORBIDDEN' });
    expect(calendarService.resetWorkday).not.toHaveBeenCalled();
    session.user.role = 'admin';
    await controller.resetWorkday({ date: '2026-08-03' }, session as never);
    expect(calendarService.resetWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      'user-1',
    );
    expect(
      getThrownResponse(() =>
        controller.resetWorkday({ date: 'not-a-date' }, session as never),
      ),
    ).toMatchObject({ code: 'DATE_INVALID' });
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
