jest.mock('../users-admin/users-admin-credential-account', () => ({
  hashUserPassword: jest.fn(),
  createCredentialAccount: jest.fn(),
}));
import { UsersAdminController } from '../users-admin/users-admin.controller';
import { DictionariesAdminController } from '../dictionaries-admin/dictionaries-admin.controller';
import { SearchAdminController } from '../search/search-admin.controller';
import { PositionsAdminService } from '../users-admin/positions-admin.service';
import { EmployeesAdminService } from '../users-admin/employees-admin.service';
import { UserAccountsAdminService } from '../users-admin/user-accounts-admin.service';
import { UserCredentialsAdminService } from '../users-admin/user-credentials-admin.service';
import { UserPhotosAdminService } from '../users-admin/user-photos-admin.service';
import { UserStatusAdminService } from '../users-admin/user-status-admin.service';
import { DictionariesAdminService } from '../dictionaries-admin/dictionaries-admin.service';
import { SearchRebuildService } from '../search/search-rebuild.service';
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

import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import {
  createPermissionsHttpFixture,
  mutationPayload,
  type HttpOperation,
} from './permissions-http.fixture';

import { hasPermission, type Permission } from './permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from './role-module-policy';
import { REQUIRED_PERMISSION } from './require-permission';

type Operation = HttpOperation & {
  group: string;
  action: string;
  permission: Permission;
};
function routesRequiring(permission: Permission) {
  return (
    method: string,
    path: string,
    group: string,
    action: string,
    upload?: boolean,
  ): Operation => ({ method, path, group, action, upload, permission });
}
const userRoute = routesRequiring('users.manage');
const dictionaryRoute = routesRequiring('dictionaries.manage');
const searchRoute = routesRequiring('search.manage');
const users = '/api/users/admin';
const dictionaries = '/api/dictionaries/admin';
const operations: Operation[] = [
  userRoute('GET', users + '/positions', 'positions', 'list'),
  userRoute('POST', users + '/positions', 'positions', 'save'),
  userRoute('PUT', users + '/positions/:id', 'positions', 'save'),
  userRoute('PATCH', users + '/positions/:id/status', 'positions', 'setStatus'),
  userRoute('GET', users + '/roles', 'accounts', 'getRoles'),
  userRoute('GET', users + '/employees', 'employees', 'listEmployees'),
  userRoute('POST', users + '/employees', 'employees', 'createEmployee'),
  userRoute(
    'PUT',
    users + '/employees/:employeeId',
    'employees',
    'updateEmployee',
  ),
  userRoute(
    'PATCH',
    users + '/employees/:employeeId/status',
    'employees',
    'setEmployeeStatus',
  ),
  userRoute('GET', users + '/accounts', 'accounts', 'listUsers'),
  userRoute('POST', users + '/accounts', 'accounts', 'createUser'),
  userRoute('PUT', users + '/accounts/:userId', 'accounts', 'updateUser'),
  userRoute(
    'PATCH',
    users + '/accounts/:userId/password',
    'credentials',
    'setUserPassword',
  ),
  userRoute(
    'PATCH',
    users + '/accounts/:userId/status',
    'status',
    'setUserStatus',
  ),
  userRoute(
    'POST',
    users + '/accounts/:userId/photo',
    'photos',
    'uploadPhoto',
    true,
  ),
  userRoute(
    'DELETE',
    users + '/accounts/:userId/photo',
    'photos',
    'deletePhoto',
  ),
  dictionaryRoute(
    'GET',
    dictionaries + '/overview',
    'dictionaries',
    'getOverview',
  ),
  ...[
    ['manufacturers', 'Manufacturers', 'Manufacturer'],
    ['models', 'EquipmentModels', 'EquipmentModel'],
    ['countries', 'Countries', 'Country'],
    ['objects', 'Objects', 'Object'],
    ['locations', 'Locations', 'Location'],
  ].flatMap(([path, plural, singular]) => [
    dictionaryRoute(
      'GET',
      `${dictionaries}/${path}`,
      'dictionaries',
      `list${plural}`,
    ),
    dictionaryRoute(
      'POST',
      `${dictionaries}/${path}`,
      'dictionaries',
      `create${singular}`,
    ),
    dictionaryRoute(
      'PUT',
      `${dictionaries}/${path}/:id`,
      'dictionaries',
      `update${singular}`,
    ),
    dictionaryRoute(
      'DELETE',
      `${dictionaries}/${path}/:id`,
      'dictionaries',
      `delete${singular}`,
    ),
  ]),
  searchRoute('POST', '/api/search/admin/rebuild', 'search', 'rebuildAll'),
  searchRoute(
    'POST',
    '/api/search/admin/rebuild/:entityType',
    'search',
    'rebuildEntityType',
  ),
];
const controllers = [
  UsersAdminController,
  DictionariesAdminController,
  SearchAdminController,
];
const providerBindings = [
  [PositionsAdminService, 'positions'],
  [EmployeesAdminService, 'employees'],
  [UserAccountsAdminService, 'accounts'],
  [UserCredentialsAdminService, 'credentials'],
  [UserPhotosAdminService, 'photos'],
  [UserStatusAdminService, 'status'],
  [DictionariesAdminService, 'dictionaries'],
  [SearchRebuildService, 'search'],
] as const;

describe('Administrative controllers through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const services: Record<
    string,
    Record<string, jest.Mock<Promise<unknown>, unknown[]>>
  > = {};
  for (const { group, action } of operations) {
    services[group] ??= {};
    services[group][action] ??= jest
      .fn<Promise<unknown>, unknown[]>()
      .mockResolvedValue({});
  }
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers,
      providers: providerBindings.map(([provide, group]) => ({
        provide,
        useValue: services[group],
      })),
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
    for (const service of Object.values(services))
      for (const mock of Object.values(service))
        expect(mock).not.toHaveBeenCalled();
  }
  it('includes every actual administrative route exactly once in the HTTP matrix', () => {
    const actual = controllers.flatMap((controller) => {
      const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
      return Object.getOwnPropertyNames(controller.prototype).flatMap(
        (name) => {
          const handler: unknown = Object.getOwnPropertyDescriptor(
            controller.prototype,
            name,
          )?.value;
          if (typeof handler !== 'function') return [];
          const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
          if (typeof method !== 'number') return [];
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
          const permission: unknown = Reflect.getMetadata(
            REQUIRED_PERMISSION,
            handler,
          );
          return [
            `${RequestMethod[method]} /${prefix}/${path} ${String(permission)}`,
          ];
        },
      );
    });
    const declared = operations.map(
      (op) => `${op.method} ${op.path} ${op.permission}`,
    );
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared.sort()).toEqual(actual.sort());
  });
  describe.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'admin,operator',
  ])('role %s', (role) => {
    it.each(operations)('$method $path', async (operation) => {
      const effectiveRole = getEffectiveUserRoles(role, http.modules).join(',');
      const allowed = hasPermission(effectiveRole, operation.permission);
      expect((await request(operation, role)).status).toBe(
        allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
      );
      if (allowed)
        expect(
          services[operation.group][operation.action],
        ).toHaveBeenCalledTimes(1);
      else expectNoServiceCalls();
    });
  });
  it.each(operations)(
    'requires authentication: $method $path',
    async (operation) => {
      expect((await request(operation)).status).toBe(401);
      expectNoServiceCalls();
    },
  );
  it('keeps administrative access with an active admin and disabled equipment role', async () => {
    http.modules.splice(0);
    expect((await request(operations[0], 'admin,engineer')).status).toBe(200);
  });
  describe.each(['0', '-1', '9007199254740992', 'invalid'])(
    'invalid users admin route ID %s',
    (id) => {
      it.each(
        operations.filter(
          (op) =>
            (op.group === 'positions' || op.group === 'employees') &&
            op.path.includes(':'),
        ),
      )(
        'rejects $method $path before calling the service',
        async (operation) => {
          const response = await request(
            {
              ...operation,
              path: operation.path.replace(/:(?:employeeId|id)\b/g, id),
            },
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
  it('preserves audit actors and target identifiers on account mutations', async () => {
    for (const operation of operations.filter((op) => op.method !== 'GET'))
      await request(operation, 'admin');
    const payload = mutationPayload;
    expect(services.positions.save).toHaveBeenCalledWith(1, payload, 'actor');
    expect(services.employees.setEmployeeStatus).toHaveBeenCalledWith({
      actorUserId: 'actor',
      employeeId: 1,
      isActive: false,
    });
    expect(services.accounts.updateUser).toHaveBeenCalledWith(
      'target',
      payload,
      'actor',
    );
    expect(services.credentials.setUserPassword).toHaveBeenCalledWith(
      'target',
      payload,
      'actor',
    );
    expect(services.status.setUserStatus).toHaveBeenCalledWith({
      banned: true,
      currentUserId: 'actor',
      userId: 'target',
    });
    expect(services.photos.uploadPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'actor', userId: 'target' }),
    );
    expect(services.photos.deletePhoto).toHaveBeenCalledWith({
      actorUserId: 'actor',
      userId: 'target',
    });
  });
});
