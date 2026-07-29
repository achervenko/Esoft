jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import { EventsController } from './events.controller';

type ErrorResponse = {
  code: string;
  message: string;
};

type ExceptionWithResponse = {
  getResponse: () => unknown;
};

describe('EventsController', () => {
  function createController() {
    const eventsService = {
      cancel: jest.fn().mockResolvedValue({ id: 1 }),
      complete: jest.fn().mockResolvedValue({ id: 1 }),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      start: jest.fn().mockResolvedValue({ id: 1 }),
      updateCreated: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const controller = new EventsController(eventsService as never);
    const session = {
      user: {
        id: 'user-1',
        role: 'admin',
      },
    };

    return { controller, eventsService, session };
  }

  it('creates generic event through public endpoint', async () => {
    const { controller, eventsService, session } = createController();

    await expect(
      controller.create(
        {
          note: '',
          plannedDate: '2026-08-01',
          responsibleUserIds: ['user-1'],
          title: ' Standalone event ',
        },
        session as never,
      ),
    ).resolves.toEqual({ id: 1 });

    expect(eventsService.create).toHaveBeenCalledWith(
      {
        checklistAssignments: [],
        extensionCode: null,
        note: null,
        originalPlannedDate: new Date('2026-08-01T00:00:00.000Z'),
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        responsibleUserIds: ['user-1'],
        source: 'MANUAL',
        title: 'Standalone event',
      },
      'user-1',
    );
  });

  it('rejects create before parser for user without event management permission', () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'engineer';

    expectThrownResponse(
      () =>
        controller.create(
          {
            title: '',
          },
          session as never,
        ),
      {
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для управления событиями.',
      },
    );
    expect(eventsService.create).not.toHaveBeenCalled();
  });

  it('rejects invalid create payload before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () =>
        controller.create(
          {
            plannedDate: '2026-08-01',
            responsibleUserIds: ['user-1'],
          },
          session as never,
        ),
      {
        code: 'TITLE_REQUIRED',
        message: 'Укажите название события.',
      },
    );
    expect(eventsService.create).not.toHaveBeenCalled();
  });

  it('rejects create extension fields before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () =>
        controller.create(
          {
            extensionCode: 'EQUIPMENT',
            plannedDate: '2026-08-01',
            responsibleUserIds: ['user-1'],
            title: 'Standalone event',
          },
          session as never,
        ),
      {
        code: 'EVENT_EXTENSION_FIELDS_UNSUPPORTED',
        message:
          'Общий endpoint события не принимает поля расширения оборудования.',
      },
    );
    expect(eventsService.create).not.toHaveBeenCalled();
  });

  it('loads generic event list through public endpoint', async () => {
    const { controller, eventsService, session } = createController();

    await expect(
      controller.findAll(
        {
          dateFrom: '2026-08-01',
          extensionCode: 'NONE',
          limit: '25',
          offset: '10',
          responsibleUserId: 'user-1',
          source: 'MANUAL',
          status: 'CREATED',
        },
        session as never,
      ),
    ).resolves.toEqual([{ id: 1 }]);

    expect(eventsService.findAll).toHaveBeenCalledWith({
      limit: 25,
      offset: 10,
      where: {
        extensionCode: null,
        plannedDate: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
        },
        responsibles: {
          some: {
            userId: 'user-1',
          },
        },
        source: 'MANUAL',
        status: 'CREATED',
      },
    });
  });

  it('allows user with read permission to load event list and detail', async () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'engineer';

    await expect(controller.findAll({}, session as never)).resolves.toEqual([
      { id: 1 },
    ]);
    await expect(controller.findOne(1, session as never)).resolves.toEqual({
      id: 1,
    });

    expect(eventsService.findAll).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      where: {},
    });
    expect(eventsService.findOne).toHaveBeenCalledWith(1);
  });

  it('rejects generic event list for user without view permission', () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'operator';

    expectThrownResponse(() => controller.findAll({}, session as never), {
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для просмотра событий.',
    });
    expect(eventsService.findAll).not.toHaveBeenCalled();
  });

  it('rejects invalid list query before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () =>
        controller.findAll(
          {
            status: 'UNKNOWN',
          },
          session as never,
        ),
      {
        code: 'EVENT_STATUS_INVALID',
        message: 'Некорректный статус события.',
      },
    );
    expect(eventsService.findAll).not.toHaveBeenCalled();
  });

  it('loads generic event detail through public endpoint', async () => {
    const { controller, eventsService, session } = createController();

    await expect(controller.findOne(1, session as never)).resolves.toEqual({
      id: 1,
    });

    expect(eventsService.findOne).toHaveBeenCalledWith(1);
  });

  it('rejects generic event detail for user without view permission', () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'operator';

    expectThrownResponse(() => controller.findOne(1, session as never), {
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для просмотра событий.',
    });
    expect(eventsService.findOne).not.toHaveBeenCalled();
  });

  it('updates event through generic endpoint', async () => {
    const { controller, eventsService, session } = createController();

    await expect(
      controller.updateCreated(
        1,
        {
          plannedDate: '2026-08-01',
          title: ' Updated event ',
          version: 2,
        },
        session as never,
      ),
    ).resolves.toEqual({ id: 1 });

    expect(eventsService.updateCreated).toHaveBeenCalledWith(
      1,
      {
        plannedDate: new Date('2026-08-01T00:00:00.000Z'),
        title: 'Updated event',
        version: 2,
      },
      'user-1',
    );
  });

  it('rejects user without event management permission', () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'engineer';

    expectThrownResponse(
      () =>
        controller.updateCreated(
          1,
          {
            title: 'Updated event',
            version: 2,
          },
          session as never,
        ),
      {
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для управления событиями.',
      },
    );
    expect(eventsService.updateCreated).not.toHaveBeenCalled();
  });

  it.each([
    {
      dto: {
        equipmentVisibleId: 1001,
        version: 2,
      },
      fieldName: 'equipmentVisibleId',
    },
    {
      dto: {
        maintenanceTypeId: 10,
        version: 2,
      },
      fieldName: 'maintenanceTypeId',
    },
  ])(
    'rejects equipment extension field $fieldName before calling service',
    ({ dto }) => {
      const { controller, eventsService, session } = createController();

      expectThrownResponse(
        () => controller.updateCreated(1, dto, session as never),
        {
          code: 'EVENT_EXTENSION_FIELDS_UNSUPPORTED',
          message:
            'Общий endpoint события не принимает поля расширения оборудования.',
        },
      );
      expect(eventsService.updateCreated).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid payload before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () =>
        controller.updateCreated(
          1,
          {
            title: 'Updated event',
          },
          session as never,
        ),
      {
        code: 'VERSION_REQUIRED',
        message: 'Укажите версию события.',
      },
    );
    expect(eventsService.updateCreated).not.toHaveBeenCalled();
  });

  it.each([
    {
      dto: { version: 2 },
      methodName: 'start',
      serviceMethodName: 'start',
    },
    {
      dto: {
        factDate: '2026-08-01',
        version: 2,
      },
      expectedData: {
        factDate: new Date('2026-08-01T00:00:00.000Z'),
        version: 2,
      },
      methodName: 'complete',
      serviceMethodName: 'complete',
    },
    {
      dto: { version: 2 },
      methodName: 'cancel',
      serviceMethodName: 'cancel',
    },
  ] as const)(
    'runs $methodName lifecycle endpoint',
    async ({ dto, expectedData, methodName, serviceMethodName }) => {
      const { controller, eventsService, session } = createController();

      await expect(
        controller[methodName](1, dto, session as never),
      ).resolves.toEqual({ id: 1 });

      expect(eventsService[serviceMethodName]).toHaveBeenCalledWith(
        1,
        expectedData ?? dto,
        'user-1',
      );
    },
  );

  it('rejects lifecycle endpoint for user without event management permission', () => {
    const { controller, eventsService, session } = createController();

    session.user.role = 'engineer';

    expectThrownResponse(
      () => controller.start(1, { version: 2 }, session as never),
      {
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для управления событиями.',
      },
    );
    expect(eventsService.start).not.toHaveBeenCalled();
  });

  it('rejects lifecycle endpoint without version before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(() => controller.cancel(1, {}, session as never), {
      code: 'VERSION_REQUIRED',
      message: 'Укажите версию события.',
    });
    expect(eventsService.cancel).not.toHaveBeenCalled();
  });

  it('rejects complete with invalid fact date before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () =>
        controller.complete(
          1,
          {
            factDate: '2026-02-30',
            version: 2,
          },
          session as never,
        ),
      {
        code: 'FACT_DATE_INVALID',
        message: 'Некорректная фактическая дата.',
      },
    );
    expect(eventsService.complete).not.toHaveBeenCalled();
  });

  it('rejects lifecycle endpoint without body before calling service', () => {
    const { controller, eventsService, session } = createController();

    expectThrownResponse(
      () => controller.start(1, undefined, session as never),
      {
        code: 'VERSION_REQUIRED',
        message: 'Укажите версию события.',
      },
    );
    expect(eventsService.start).not.toHaveBeenCalled();
  });
});

function expectThrownResponse(
  action: () => unknown,
  expectedResponse: ErrorResponse,
): void {
  try {
    action();
    throw new Error('Expected exception');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(readExceptionResponse(error)).toEqual(expectedResponse);
  }
}

function readExceptionResponse(error: unknown): unknown {
  if (hasExceptionResponse(error)) {
    return error.getResponse();
  }

  return undefined;
}

function hasExceptionResponse(error: unknown): error is ExceptionWithResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getResponse' in error &&
    typeof error.getResponse === 'function'
  );
}
