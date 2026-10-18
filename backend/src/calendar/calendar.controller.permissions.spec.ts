jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});

import type { ExecutionContext } from '@nestjs/common';
import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../auth/permissions-http.fixture';
import { hasPermission, type Permission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import { CALENDAR_PERMISSIONS } from './calendar.permissions';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarEngineService } from './engine/calendar-engine.service';
import { CalendarSourceResolver } from './engine/calendar-source.resolver';

describe('CalendarController authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const engine = {
    buildCalendar: jest.fn().mockResolvedValue({ days: [], layers: [] }),
  };
  const calendar = {
    getDay: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
    getRange: jest.fn().mockResolvedValue({ days: [] }),
    updateWorkday: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
    resetWorkday: jest.fn().mockResolvedValue({ date: '2026-08-03' }),
  };
  const resolver = {
    resolveProviders: jest.fn().mockReturnValue(['provider']),
  };
  const operations: (HttpOperation & { permission: Permission })[] = [
    {
      path: '/api/calendar?from=2026-08-01&to=2026-08-31',
      method: 'GET',
      permission: CALENDAR_PERMISSIONS.READ,
    },
    {
      path: '/api/calendar/day?date=2026-08-03',
      method: 'GET',
      permission: CALENDAR_PERMISSIONS.MANAGE,
    },
    {
      path: '/api/calendar/range?dateFrom=2026-08-01&dateTo=2026-08-02',
      method: 'GET',
      permission: CALENDAR_PERMISSIONS.MANAGE,
    },
    {
      path: '/api/calendar/workday',
      method: 'PATCH',
      permission: CALENDAR_PERMISSIONS.MANAGE,
      body: { date: '2026-08-03', holidayName: 'Test holiday' },
    },
    {
      path: '/api/calendar/workday/reset',
      method: 'PATCH',
      permission: CALENDAR_PERMISSIONS.MANAGE,
      body: { date: '2026-08-03' },
    },
  ];
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [CalendarController],
      providers: [
        { provide: CalendarEngineService, useValue: engine },
        { provide: CalendarService, useValue: calendar },
        { provide: CalendarSourceResolver, useValue: resolver },
      ],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(
      0,
      http.modules.length,
      'equipment',
      'ppe',
      'warehouse',
    );
  });
  const request = (operation: HttpOperation, role?: string) =>
    http.request(operation, role);
  const serviceMocks = () => [
    ...Object.values(calendar),
    ...Object.values(engine),
    ...Object.values(resolver),
  ];

  it.each([...USER_ROLES, 'engineer,storekeeper', 'admin,operator', 'unknown'])(
    'checks the permission of every calendar handler for %s',
    async (role) => {
      for (const operation of operations) {
        jest.clearAllMocks();
        const effectiveRole = getEffectiveUserRoles(role, http.modules).join(
          ',',
        );
        const allowed = hasPermission(effectiveRole, operation.permission);
        const response = await request(operation, role);
        expect(response.status).toBe(allowed ? 200 : 403);
        if (!allowed)
          for (const mock of serviceMocks())
            expect(mock).not.toHaveBeenCalled();
      }
    },
  );
  it('does not invoke calendar services without a session', async () => {
    for (const operation of operations)
      expect((await request(operation)).status).toBe(401);
    for (const mock of serviceMocks()) expect(mock).not.toHaveBeenCalled();
  });
  it('filters disabled roles while preserving active admin permissions', async () => {
    http.modules.splice(0);
    expect((await request(operations[0], 'engineer,storekeeper')).status).toBe(
      403,
    );
    for (const mock of serviceMocks()) expect(mock).not.toHaveBeenCalled();
    expect((await request(operations[0], 'admin,engineer')).status).toBe(200);
    expect(resolver.resolveProviders).toHaveBeenCalledWith({
      user: { id: 'actor', role: 'admin' },
    });
  });
  it('forwards the actor for updates and keeps input validation after authorization', async () => {
    expect((await request(operations[3], 'admin')).status).toBe(200);
    expect(calendar.updateWorkday).toHaveBeenCalledWith(
      {
        date: new Date('2026-08-03T00:00:00.000Z'),
        holidayName: 'Test holiday',
      },
      'actor',
    );
    expect((await request(operations[4], 'admin')).status).toBe(200);
    expect(calendar.resetWorkday).toHaveBeenCalledWith(
      new Date('2026-08-03T00:00:00.000Z'),
      'actor',
    );
    calendar.resetWorkday.mockClear();
    const invalid = { ...operations[4], body: { date: 'not-a-date' } };
    expect((await request(invalid, 'engineer')).status).toBe(403);
    const response = await request(invalid, 'admin');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'DATE_INVALID' });
    expect(calendar.resetWorkday).not.toHaveBeenCalled();
  });
});
