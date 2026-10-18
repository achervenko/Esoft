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

import { type ExecutionContext, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { REQUIRED_PERMISSION } from '../auth/require-permission';
import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../auth/permissions-http.fixture';
import { hasPermission, type Permission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import { EVENTS_PERMISSIONS } from './events.permissions';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
type Operation = HttpOperation & {
  permission: Permission;
  action: string;
};
const operations: Operation[] = [
  {
    path: '/api/events',
    method: 'GET',
    permission: EVENTS_PERMISSIONS.READ,
    action: 'findAll',
  },
  {
    path: '/api/events/1',
    method: 'GET',
    permission: EVENTS_PERMISSIONS.READ,
    action: 'findOne',
  },
  {
    path: '/api/events/responsible-users',
    method: 'GET',
    permission: EVENTS_PERMISSIONS.MANAGE,
    action: 'findResponsibleUsers',
  },
  {
    path: '/api/events',
    method: 'POST',
    permission: EVENTS_PERMISSIONS.MANAGE,
    action: 'create',
    body: {
      title: ' Test ',
      plannedDate: '2026-08-01',
      responsibleUserIds: ['actor'],
    },
  },
  {
    path: '/api/events/1',
    method: 'PATCH',
    permission: EVENTS_PERMISSIONS.MANAGE,
    action: 'updateCreated',
    body: { title: 'Updated', version: 1 },
  },
  ...['start', 'complete', 'cancel'].map((action) => ({
    path: '/api/events/1/' + action,
    method: 'POST',
    permission: EVENTS_PERMISSIONS.MANAGE,
    action,
    body: { version: 1 },
  })),
];
describe('EventsController authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    operations.map((op) => [
      op.action,
      jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
    ]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: service },
        {
          provide: EventExtensionRegistry,
          useValue: new EventExtensionRegistry([]),
        },
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
  function expectNoServiceCalls() {
    for (const mock of Object.values(service))
      expect(mock).not.toHaveBeenCalled();
  }
  it('covers every HTTP handler with its declared permission', () => {
    const prefix = Reflect.getMetadata(
      PATH_METADATA,
      EventsController,
    ) as string;
    const actual = Object.getOwnPropertyNames(
      EventsController.prototype,
    ).flatMap((name) => {
      const handler: unknown = Object.getOwnPropertyDescriptor(
        EventsController.prototype,
        name,
      )?.value;
      if (typeof handler !== 'function') return [];
      const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
      if (typeof method !== 'number') return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const fullPath = `/${prefix}/${path}`
        .replace(/:id\b/g, '1')
        .replace(/\/+$/, '');
      const permission: unknown = Reflect.getMetadata(
        REQUIRED_PERMISSION,
        handler,
      );
      return [`${RequestMethod[method]} ${fullPath} ${String(permission)}`];
    });
    const declared = operations.map(
      (op) => `${op.method} ${op.path} ${op.permission}`,
    );
    expect(declared.sort()).toEqual(actual.sort());
  });
  it.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'chief_engineer,storekeeper',
    'admin,operator',
  ])('checks every handler for %s', async (role) => {
    for (const operation of operations) {
      jest.clearAllMocks();
      const effectiveRole = getEffectiveUserRoles(role, http.modules).join(',');
      const allowed = hasPermission(effectiveRole, operation.permission);
      expect((await request(operation, role)).status).toBe(
        allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
      );
      if (allowed) expect(service[operation.action]).toHaveBeenCalledTimes(1);
      else expectNoServiceCalls();
    }
  });
  it('rejects unauthenticated requests without service calls', async () => {
    for (const operation of operations)
      expect((await request(operation)).status).toBe(401);
    expectNoServiceCalls();
  });
  it('filters disabled equipment roles while preserving admin access', async () => {
    http.modules.splice(0, http.modules.length, 'warehouse');
    for (const operation of operations)
      expect(
        (await request(operation, 'chief_engineer,storekeeper')).status,
      ).toBe(403);
    expectNoServiceCalls();
    for (const operation of operations)
      expect((await request(operation, 'admin,engineer')).status).toBe(
        operation.method === 'POST' ? 201 : 200,
      );
  });
  it('forwards actor, IDs, versions and parsed creation data', async () => {
    for (const operation of operations.filter((op) => op.method !== 'GET')) {
      jest.clearAllMocks();
      expect((await request(operation, 'chief_engineer')).status).toBe(
        operation.method === 'POST' ? 201 : 200,
      );
      const calls = service[operation.action].mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0].at(-1)).toBe('actor');
    }
    for (const action of ['start', 'complete', 'cancel']) {
      await request(
        operations.find((op) => op.action === action)!,
        'admin',
      );
      expect(service[action]).toHaveBeenCalledWith(
        1,
        action === 'complete'
          ? { version: 1, factDate: undefined }
          : { version: 1 },
        'actor',
      );
    }
    await request(operations[3], 'admin');
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test',
        plannedDate: new Date('2026-08-01T00:00:00Z'),
        responsibleUserIds: ['actor'],
      }),
      'actor',
    );
  });
  describe.each(['0', '-1', '9007199254740992'])(
    'invalid event ID %s',
    (id) => {
      it.each(operations.filter((operation) => operation.path.includes('/1')))(
        'rejects $method $path before calling the service',
        async (operation) => {
          const response = await request(
            { ...operation, path: operation.path.replace('/1', '/' + id) },
            'admin',
          );
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({
            code: 'ROUTE_ID_INVALID',
          });
          expectNoServiceCalls();
        },
      );
    },
  );
  it('keeps validation after authorization', async () => {
    const invalid = { ...operations[3], body: {} };
    expect((await request(invalid, 'engineer')).status).toBe(403);
    expect((await request(invalid, 'admin')).status).toBe(400);
    expect(
      (
        await request(
          { ...operations[1], path: '/api/events/invalid' },
          'admin',
        )
      ).status,
    ).toBe(400);
    expect(
      (await request({ ...operations[5], body: {} }, 'admin')).status,
    ).toBe(400);
    expectNoServiceCalls();
  });
});
