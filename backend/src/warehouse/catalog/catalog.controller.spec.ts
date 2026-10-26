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
import { REQUIRED_PERMISSION } from '../../auth/require-permission';
import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../../auth/permissions-http.fixture';
import { hasPermission, type Permission } from '../../auth/permission-policy';
import {
  USER_ROLES,
  getEffectiveUserRoles,
} from '../../auth/role-module-policy';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseCatalogController } from './catalog.controller';
import { WarehouseCatalogService } from './catalog.service';
import { parseCreateUserPayload } from '../../users-admin/users-admin.validation';
import { getRoleLabel } from '../../users-admin/users-admin.mapper';

describe('Warehouse Catalog authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    setStatus: jest.fn().mockResolvedValue({}),
  };
  const operations = [
    {
      path: '/api/warehouse/items?q=bearing',
      method: 'GET',
      permission: WAREHOUSE_PERMISSIONS.CATALOG_MANAGE,
      service: 'list',
    },
    {
      path: '/api/warehouse/items/9007199254740993',
      method: 'GET',
      permission: WAREHOUSE_PERMISSIONS.CATALOG_MANAGE,
      service: 'findOne',
    },
    {
      path: '/api/warehouse/items',
      method: 'POST',
      permission: WAREHOUSE_PERMISSIONS.CATALOG_MANAGE,
      service: 'create',
      body: { article: 'A', name: 'Bearing', unit: 'pcs' },
    },
    {
      path: '/api/warehouse/items/9007199254740993',
      method: 'PATCH',
      permission: WAREHOUSE_PERMISSIONS.CATALOG_MANAGE,
      service: 'update',
      body: { name: 'Updated' },
    },
    {
      path: '/api/warehouse/items/9007199254740993/status',
      method: 'PATCH',
      permission: WAREHOUSE_PERMISSIONS.CATALOG_MANAGE,
      service: 'setStatus',
      body: { isActive: false },
    },
  ] as const satisfies readonly (HttpOperation & {
    permission: Permission;
    service: keyof typeof service;
  })[];
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseCatalogController],
      providers: [{ provide: WarehouseCatalogService, useValue: service }],
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
      WarehouseCatalogController,
    ) as string;
    const actual = Object.getOwnPropertyNames(
      WarehouseCatalogController.prototype,
    ).flatMap((name) => {
      const handler: unknown = Object.getOwnPropertyDescriptor(
        WarehouseCatalogController.prototype,
        name,
      )?.value;
      if (typeof handler !== 'function') return [];
      const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
      if (typeof method !== 'number') return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const fullPath = `/${prefix}/${path}`
        .replace(/:id\b/g, '9007199254740993')
        .replace(/\/+$/, '');
      const permission: unknown = Reflect.getMetadata(
        REQUIRED_PERMISSION,
        handler,
      );
      return [`${RequestMethod[method]} ${fullPath} ${String(permission)}`];
    });
    const declared = operations.map(
      (op) => `${op.method} ${op.path.split('?')[0]} ${op.permission}`,
    );
    expect(declared.sort()).toEqual(actual.sort());
  });
  it.each([...USER_ROLES, 'unknown', 'engineer,storekeeper', 'admin,operator'])(
    'checks every handler for %s',
    async (role) => {
      for (const operation of operations) {
        jest.clearAllMocks();
        const effectiveRole = getEffectiveUserRoles(role, http.modules).join(
          ',',
        );
        const allowed = hasPermission(effectiveRole, operation.permission);
        expect((await request(operation, role)).status).toBe(
          allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
        );
        if (allowed)
          expect(service[operation.service]).toHaveBeenCalledTimes(1);
        else expectNoServiceCalls();
      }
    },
  );
  it('rejects requests without a session before calling any service', async () => {
    for (const operation of operations)
      expect((await request(operation)).status).toBe(401);
    expectNoServiceCalls();
  });
  it('denies disabled warehouse access even to admin', async () => {
    http.modules.splice(0, http.modules.length, 'equipment');
    for (const operation of operations) {
      expect((await request(operation, 'engineer,storekeeper')).status).toBe(
        403,
      );
    }
    expectNoServiceCalls();
    expect((await request(operations[0], 'admin,storekeeper')).status).toBe(
      403,
    );
    expectNoServiceCalls();
  });
  it('forwards query, string IDs, payloads and audit actor', async () => {
    for (const operation of operations) await request(operation, 'storekeeper');
    expect(service.list).toHaveBeenCalledWith({ q: 'bearing' });
    expect(service.findOne).toHaveBeenCalledWith('9007199254740993');
    expect(service.create).toHaveBeenCalledWith(operations[2].body, 'actor');
    expect(service.update).toHaveBeenCalledWith(
      '9007199254740993',
      operations[3].body,
      'actor',
    );
    expect(service.setStatus).toHaveBeenCalledWith(
      '9007199254740993',
      operations[4].body,
      'actor',
    );
  });
});

it('registers storekeeper for account management without granting unknown roles', () => {
  expect(
    parseCreateUserPayload({
      username: 'keeper',
      email: 'keeper@test.invalid',
      password: 'password123',
      role: 'storekeeper',
      employeeId: 1,
    }).role,
  ).toBe('storekeeper');
  expect(getRoleLabel('storekeeper')).toBe('Кладовщик');
  for (const value of [null, undefined, {}, 'STOREKEEPER'])
    expect(hasPermission(value, 'warehouse.catalog.manage')).toBe(false);
});
