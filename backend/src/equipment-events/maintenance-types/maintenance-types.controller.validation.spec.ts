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
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import { MaintenanceTypesController } from './maintenance-types.controller';
import { MaintenanceTypesService } from './maintenance-types.service';

const operations = [
  {
    method: 'PATCH',
    suffix: '',
    action: 'updateType',
    body: { name: 'Updated' },
  },
  {
    method: 'POST',
    suffix: '/activate',
    action: 'activateType',
    body: undefined,
  },
  {
    method: 'POST',
    suffix: '/deactivate',
    action: 'deactivateType',
    body: undefined,
  },
];
describe('Maintenance type route ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    operations.map((op) => [op.action, jest.fn().mockResolvedValue({})]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [MaintenanceTypesController],
      providers: [{ provide: MaintenanceTypesService, useValue: service }],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'equipment');
  });
  describe.each(['0', '-1', '9007199254740992'])('invalid type ID %s', (id) => {
    it.each(operations)(
      'rejects $method /:id$suffix before the service',
      async (operation) => {
        const response = await http.request(
          {
            ...operation,
            path: `/api/maintenance-types/${id}${operation.suffix}`,
          },
          'admin',
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          code: 'ROUTE_ID_INVALID',
        });
        for (const mock of Object.values(service))
          expect(mock).not.toHaveBeenCalled();
      },
    );
  });
});
