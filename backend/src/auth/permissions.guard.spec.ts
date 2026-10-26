import optionalModuleIds from '../../prisma/module-catalog.json';
import { hasPermission } from './permission-policy';
import { USER_ROLES } from './role-module-policy';
import {
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Req,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { ACTIVE_MODULES } from '../config/active-modules.module';
import { AUTHENTICATE_REQUEST, PermissionsGuard } from './permissions.guard';
import { RequirePermission, REQUIRED_PERMISSION } from './require-permission';

const calls = jest.fn();
type FixtureRequest = Request & {
  session?: { user: { id: string; role: string; assignedRole?: string } };
};
@Controller('api')
class FixtureController {
  @Get('search') @RequirePermission('search.read') search(
    @Req()
    request: Request & {
      session: { user: { role: string; assignedRole: string } };
      user: { role: string };
    },
  ) {
    calls();
    return {
      role: request.session.user.role,
      assignedRole: request.session.user.assignedRole,
      requestRole: request.user.role,
    };
  }
  @Get('equipment') @RequirePermission('equipment.read') equipment() {
    calls();
    return { ok: true };
  }
  @Get('warehouse/items')
  @RequirePermission('warehouse.catalog.manage')
  warehouse() {
    calls();
    return { ok: true };
  }
  @Get('ppe/items') @RequirePermission('ppe.read') ppe() {
    calls();
    return { ok: true };
  }
  @Get('search-with-modules')
  @RequirePermission('search.read', 'equipment.read', 'ppe.read')
  searchWithModules() {
    calls();
    return { ok: true };
  }
  @Get('users/admin') @RequirePermission('users.manage') users() {
    calls();
    return { ok: true };
  }
  @Get('users/:id/profile') @RequirePermission('users.profile.read') profile() {
    calls();
    return { ok: true };
  }
  @Get('unknown')
  @SetMetadata(REQUIRED_PERMISSION, 'unknown.permission')
  unknown() {
    calls();
  }
  @Get('health') @SetMetadata('PUBLIC', true) health() {
    calls();
    return { ok: true };
  }
  @Get('conflict')
  @SetMetadata('PUBLIC', true)
  @RequirePermission('users.manage')
  conflict() {
    calls();
  }
  @Get('equipment/new') equipmentUnmarked() {
    calls();
  }
  @Get('ppe/new') ppeUnmarked() {
    calls();
  }
  @Get('events/new') eventsUnmarked() {
    calls();
  }
  @Get('calendar/new') calendarUnmarked() {
    calls();
  }
  @Get('checklists/new') checklistsUnmarked() {
    calls();
  }
  @Get('users/new') usersUnmarked() {
    calls();
  }
  @Get('files/new') filesUnmarked() {
    calls();
  }
  @Get('warehouse/new') warehouseUnmarked() {
    calls();
  }
}
@Controller('api/inherited')
@RequirePermission('users.manage')
@SetMetadata('PUBLIC', true)
class InheritedController {
  @Get() unmarked() {
    calls();
  }
}

describe('global explicit permissions over HTTP', () => {
  let app: INestApplication;
  let base: string;
  const modules: string[] = [];
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [FixtureController, InheritedController],
      providers: [
        { provide: ACTIVE_MODULES, useValue: modules },
        {
          provide: AUTHENTICATE_REQUEST,
          useValue: (context: ExecutionContext) => {
            const request = context.switchToHttp().getRequest<FixtureRequest>();
            const role = request.headers['x-role'];
            if (typeof role === 'string')
              request.session = {
                user: {
                  id: 'self',
                  role,
                  assignedRole: String(
                    request.headers['x-assigned-role'] ?? role,
                  ),
                },
              };
            if (
              !request.session &&
              !new Reflector().getAllAndOverride('PUBLIC', [
                context.getHandler(),
                context.getClass(),
              ])
            )
              throw new UnauthorizedException();
            return Promise.resolve(true);
          },
        },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = fixture.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    calls.mockClear();
    modules.splice(0, modules.length, ...optionalModuleIds);
  });
  const get = (path: string, role?: string, assignedRole?: string) =>
    fetch(base + path, {
      headers:
        role === undefined
          ? undefined
          : { 'x-role': role, 'x-assigned-role': assignedRole ?? role },
    });

  it.each([
    'equipment',
    'ppe',
    'events',
    'calendar',
    'checklists',
    'users',
    'files',
    'warehouse',
  ])('denies an unmarked %s endpoint even to admin', async (module) => {
    expect((await get(`/api/${module}/new`, 'admin')).status).toBe(403);
    expect(calls).not.toHaveBeenCalled();
  });
  it.each(['/api/unknown', '/api/inherited', '/api/conflict'])(
    'denies unknown or inherited/ambiguous policy at %s',
    async (path) => {
      expect((await get(path, 'admin')).status).toBe(403);
      expect(calls).not.toHaveBeenCalled();
    },
  );
  it('requires authentication while allowing an explicitly public handler', async () => {
    expect((await get('/api/equipment')).status).toBe(401);
    expect(calls).not.toHaveBeenCalled();
    expect((await get('/api/health')).status).toBe(200);
  });
  it('unions role permissions without namespace restrictions', async () => {
    for (const path of ['/api/equipment', '/api/warehouse/items'])
      expect((await get(path, 'engineer,storekeeper')).status).toBe(200);
    for (const path of ['/api/ppe/items', '/api/warehouse/items'])
      expect(
        (await get(path, 'storekeeper,accounting_specialist')).status,
      ).toBe(200);
    expect((await get('/api/users/admin', 'admin,storekeeper')).status).toBe(
      200,
    );
    calls.mockClear();
    expect((await get('/api/equipment', 'storekeeper')).status).toBe(403);
    expect((await get('/api/users/admin', 'engineer,storekeeper')).status).toBe(
      403,
    );
    expect(calls).not.toHaveBeenCalled();
  });
  it('ignores assignedRole for access and filters inactive roles', async () => {
    modules.splice(0, modules.length, 'equipment');
    expect((await get('/api/equipment', 'engineer,storekeeper')).status).toBe(
      200,
    );
    calls.mockClear();
    expect(
      (await get('/api/warehouse/items', 'engineer,storekeeper')).status,
    ).toBe(403);
    expect(
      (await get('/api/users/admin', 'engineer', 'admin,engineer')).status,
    ).toBe(403);
    expect(calls).not.toHaveBeenCalled();
  });
  it.each([
    { module: 'equipment', path: '/api/equipment' },
    { module: 'ppe', path: '/api/ppe/items' },
    { module: 'warehouse', path: '/api/warehouse/items' },
  ])(
    'denies admin primary permission when $module is disabled',
    async ({ module, path }) => {
      modules.splice(
        0,
        modules.length,
        ...optionalModuleIds.filter((id) => id !== module),
      );
      for (const role of ['admin', 'admin,storekeeper']) {
        expect((await get(path, role)).status).toBe(403);
      }
      expect(calls).not.toHaveBeenCalled();
      expect((await get('/api/users/admin', 'admin')).status).toBe(200);
      modules.push(module);
      expect((await get(path, 'admin')).status).toBe(200);
    },
  );
  it.each(['admin', 'admin,storekeeper'])(
    'requires every additional module permission for %s',
    async (role) => {
      for (const active of [[], ['equipment'], ['ppe']]) {
        modules.splice(0, modules.length, ...active);
        expect((await get('/api/search-with-modules', role)).status).toBe(403);
      }
      expect(calls).not.toHaveBeenCalled();
      modules.splice(0, modules.length, 'equipment', 'ppe');
      expect((await get('/api/search-with-modules', role)).status).toBe(200);
    },
  );
  it('keeps global admin permissions when every optional module is disabled', async () => {
    modules.splice(0);
    expect((await get('/api/users/admin', 'admin')).status).toBe(200);
    expect((await get('/api/search', 'admin')).status).toBe(200);
    expect((await get('/api/health')).status).toBe(200);
  });
  it('passes effective roles to downstream business code without dropping assignments', async () => {
    modules.splice(0, modules.length, 'equipment');
    const response = await get('/api/search', 'engineer,ppe_specialist');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      role: 'engineer',
      requestRole: 'engineer',
      assignedRole: 'engineer,ppe_specialist',
    });
  });
  it('requires an active role permission even for the own profile', async () => {
    modules.splice(0);
    expect((await get('/api/users/self/profile', 'storekeeper')).status).toBe(
      403,
    );
    calls.mockClear();
    expect((await get('/api/users/other/profile', 'storekeeper')).status).toBe(
      403,
    );
    expect((await get('/api/warehouse/items', 'storekeeper')).status).toBe(403);
    expect(calls).not.toHaveBeenCalled();
    expect((await get('/api/users/other/profile', 'admin')).status).toBe(200);
  });
  it.each([...USER_ROLES])(
    'applies ownership after profile permission for active role %s',
    async (role) => {
      const canRead = hasPermission(role, 'users.profile.read');
      const canManage = hasPermission(role, 'users.manage');
      expect((await get('/api/users/self/profile', role)).status).toBe(
        canRead ? 200 : 403,
      );
      calls.mockClear();
      expect((await get('/api/users/other/profile', role)).status).toBe(
        canRead && canManage ? 200 : 403,
      );
      if (!canRead || !canManage) expect(calls).not.toHaveBeenCalled();
    },
  );
});
