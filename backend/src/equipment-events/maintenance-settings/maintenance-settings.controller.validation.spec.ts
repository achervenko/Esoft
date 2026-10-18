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
import { EquipmentMaintenanceExecutionType } from '@prisma/client';
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import { MaintenanceSettingsController } from './maintenance-settings.controller';
import { MaintenanceSettingsService } from './maintenance-settings.service';

const executionType = EquipmentMaintenanceExecutionType.INTERNAL;
const operations = [
  { method: 'GET', suffix: '', action: 'getSettings', body: undefined },
  {
    method: 'GET',
    suffix: '/available-types',
    action: 'getAvailableMaintenanceTypes',
    body: undefined,
  },
  {
    method: 'POST',
    suffix: '',
    action: 'createSetting',
    body: { maintenanceTypeId: 2, executionType },
  },
  {
    method: 'PATCH',
    suffix: '/3',
    action: 'updateSetting',
    body: { executionType },
  },
  { method: 'DELETE', suffix: '/3', action: 'deleteSetting', body: undefined },
];
describe('Maintenance settings route ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    operations.map((op) => [op.action, jest.fn().mockResolvedValue({})]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [MaintenanceSettingsController],
      providers: [{ provide: MaintenanceSettingsService, useValue: service }],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'equipment');
  });
  async function expectInvalidId(
    operation: (typeof operations)[number],
    path: string,
  ) {
    const response = await http.request({ ...operation, path }, 'admin');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ROUTE_ID_INVALID' });
    for (const mock of Object.values(service))
      expect(mock).not.toHaveBeenCalled();
  }
  describe.each(['0', '-1', '9007199254740992'])('invalid ID %s', (id) => {
    it.each(operations)(
      'rejects visibleId on $method $suffix',
      async (operation) => {
        await expectInvalidId(
          operation,
          `/api/equipment/${id}/maintenance-settings${operation.suffix}`,
        );
      },
    );
    it.each(operations.filter((op) => ['PATCH', 'DELETE'].includes(op.method)))(
      'rejects settingId on $method',
      async (operation) => {
        await expectInvalidId(
          operation,
          `/api/equipment/1/maintenance-settings/${id}`,
        );
      },
    );
  });
});
