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
import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../auth/permissions-http.fixture';
import { hasPermission, type Permission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import { REQUIRED_PERMISSION } from '../auth/require-permission';
import { EQUIPMENT_PERMISSIONS } from '../equipment/equipment.permissions';
import { EquipmentMaintenanceExecutionType } from '@prisma/client';
import { MaintenanceSettingsController } from './maintenance-settings/maintenance-settings.controller';
import { MaintenanceSettingsService } from './maintenance-settings/maintenance-settings.service';
import { MaintenanceTypesController } from './maintenance-types/maintenance-types.controller';
import { MaintenanceTypesService } from './maintenance-types/maintenance-types.service';
type Operation = HttpOperation & {
  group: number;
  action: string;
  permission: Permission;
  additionalPermission?: Permission;
};
const settings = '/api/equipment/1/maintenance-settings';
const types = '/api/maintenance-types';
const executionType = Object.values(EquipmentMaintenanceExecutionType)[0];
const operations: Operation[] = [
  {
    path: settings,
    method: 'GET',
    group: 0,
    action: 'getSettings',
    permission: EQUIPMENT_PERMISSIONS.READ,
  },
  {
    path: settings + '/available-types',
    method: 'GET',
    group: 0,
    action: 'getAvailableMaintenanceTypes',
    permission: EQUIPMENT_PERMISSIONS.READ,
  },
  {
    path: settings,
    method: 'POST',
    group: 0,
    action: 'createSetting',
    permission: EQUIPMENT_PERMISSIONS.EVENTS_MANAGE,
    body: { maintenanceTypeId: 2, executionType },
  },
  {
    path: settings + '/3',
    method: 'PATCH',
    group: 0,
    action: 'updateSetting',
    permission: EQUIPMENT_PERMISSIONS.EVENTS_MANAGE,
    body: { executionType },
  },
  {
    path: settings + '/3',
    method: 'DELETE',
    group: 0,
    action: 'deleteSetting',
    permission: EQUIPMENT_PERMISSIONS.EVENTS_MANAGE,
  },
  {
    path: types,
    method: 'GET',
    group: 1,
    action: 'getTypes',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_READ,
  },
  {
    path: types + '?includeInactive=true',
    method: 'GET',
    group: 1,
    action: 'getTypes',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_READ,
    additionalPermission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
  },
  {
    path: types,
    method: 'POST',
    group: 1,
    action: 'createType',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
    body: { code: 'TEST', name: 'Test' },
  },
  {
    path: types + '/2',
    method: 'PATCH',
    group: 1,
    action: 'updateType',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
    body: { name: 'Updated' },
  },
  {
    path: types + '/2/activate',
    method: 'POST',
    group: 1,
    action: 'activateType',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
  },
  {
    path: types + '/2/deactivate',
    method: 'POST',
    group: 1,
    action: 'deactivateType',
    permission: EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
  },
];
describe('Maintenance authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const services = [
    [
      'getSettings',
      'getAvailableMaintenanceTypes',
      'createSetting',
      'updateSetting',
      'deleteSetting',
    ],
    ['getTypes', 'createType', 'updateType', 'activateType', 'deactivateType'],
  ].map((actions) =>
    Object.fromEntries(
      actions.map((action) => [
        action,
        jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
      ]),
    ),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [MaintenanceSettingsController, MaintenanceTypesController],
      providers: [
        { provide: MaintenanceSettingsService, useValue: services[0] },
        { provide: MaintenanceTypesService, useValue: services[1] },
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
  function isAllowed(operation: Operation, role: string) {
    const effectiveRole = getEffectiveUserRoles(role, http.modules).join(',');
    return (
      hasPermission(effectiveRole, operation.permission) &&
      (!operation.additionalPermission ||
        hasPermission(effectiveRole, operation.additionalPermission))
    );
  }
  function expectNoServiceCalls() {
    for (const service of services)
      for (const mock of Object.values(service))
        expect(mock).not.toHaveBeenCalled();
  }
  it('covers actual handlers with their specific endpoint permissions', () => {
    const actual = [
      MaintenanceSettingsController,
      MaintenanceTypesController,
    ].flatMap((controller) => {
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
          const fullPath = `/${prefix}/${path}`
            .replace(/:visibleId/g, '1')
            .replace(/:settingId/g, '3')
            .replace(/:id/g, '2')
            .replace(/\/+$/, '');
          const permission: unknown = Reflect.getMetadata(
            REQUIRED_PERMISSION,
            handler,
          );
          return [`${RequestMethod[method]} ${fullPath} ${String(permission)}`];
        },
      );
    });
    // includeInactive is a query variant of the same handler, not a second endpoint.
    const declared = [
      ...new Set(
        operations.map(
          (op) => `${op.method} ${op.path.split('?')[0]} ${op.permission}`,
        ),
      ),
    ];
    expect(declared.sort()).toEqual(actual.sort());
  });
  it.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'chief_engineer,storekeeper',
    'admin,operator',
  ])('checks every maintenance operation for %s', async (role) => {
    for (const operation of operations) {
      jest.clearAllMocks();
      const allowed = isAllowed(operation, role);
      expect((await request(operation, role)).status).toBe(
        allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
      );
      if (allowed)
        expect(
          services[operation.group][operation.action],
        ).toHaveBeenCalledTimes(1);
      else expectNoServiceCalls();
    }
  });
  it('rejects unauthenticated requests without calling services', async () => {
    for (const operation of operations)
      expect((await request(operation)).status).toBe(401);
    expectNoServiceCalls();
  });
  it.each(['chief_engineer,storekeeper', 'admin,chief_engineer'])(
    'uses effective permissions with equipment disabled for %s',
    async (role) => {
      http.modules.splice(0, http.modules.length, 'warehouse');
      for (const operation of operations) {
        jest.clearAllMocks();
        expect((await request(operation, role)).status).toBe(403);
        expectNoServiceCalls();
      }
    },
  );
  it('preserves parsed payloads, IDs and audit actor', async () => {
    for (const operation of operations.filter(
      (value) => value.method !== 'GET',
    )) {
      jest.clearAllMocks();
      expect((await request(operation, 'admin')).status).toBe(
        operation.method === 'POST' ? 201 : 200,
      );
      const calls = services[operation.group][operation.action].mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0].at(-1)).toBe('actor');
    }
    expect(services[1].deactivateType).toHaveBeenCalledWith(2, 'actor');
    await request(operations[2], 'chief_engineer');
    expect(services[0].createSetting).toHaveBeenCalledWith(
      1,
      {
        maintenanceTypeId: 2,
        executionType,
        defaultChecklistTemplateId: null,
        periodicity: null,
      },
      'actor',
    );
    await request(operations[6], 'admin');
    expect(services[1].getTypes).toHaveBeenCalledWith(true);
  });
  it('keeps input validation after authorization', async () => {
    const invalid = { ...operations[2], body: {} };
    expect((await request(invalid, 'engineer')).status).toBe(403);
    expect((await request(invalid, 'chief_engineer')).status).toBe(400);
    expect(
      (
        await request(
          {
            ...operations[0],
            path: '/api/equipment/invalid/maintenance-settings',
          },
          'admin',
        )
      ).status,
    ).toBe(400);
    expectNoServiceCalls();
  });
});
