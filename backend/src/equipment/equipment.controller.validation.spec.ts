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
import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

const routes = [
  { method: 'GET', suffix: '', action: 'findOneByVisibleId' },
  { method: 'GET', suffix: '/history', action: 'findHistoryByVisibleId' },
  { method: 'PUT', suffix: '', action: 'update' },
];
describe('Equipment visible ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    ['getCreateOptions', ...routes.map((route) => route.action)].map(
      (action) => [action, jest.fn().mockResolvedValue({})],
    ),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [EquipmentController],
      providers: [{ provide: EquipmentService, useValue: service }],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'equipment');
  });
  async function expectInvalid(path: string, method: string) {
    const response = await http.request({ path, method }, 'admin');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ROUTE_ID_INVALID' });
    for (const mock of Object.values(service))
      expect(mock).not.toHaveBeenCalled();
  }
  describe.each(['0', '-1', '9007199254740992'])(
    'invalid visible ID %s',
    (id) => {
      it.each(routes)(
        'rejects $method /:visibleId$suffix',
        async ({ method, suffix }) => {
          await expectInvalid(`/api/equipment/${id}${suffix}`, method);
        },
      );
    },
  );
  it.each(['', '0', '-1', '9007199254740992', 'abc'])(
    'rejects invalid optional query value %p',
    async (value) => {
      await expectInvalid(
        `/api/equipment/create-options?visibleId=${value}`,
        'GET',
      );
    },
  );
  it('passes undefined for an absent query parameter', async () => {
    expect(
      (
        await http.request(
          { path: '/api/equipment/create-options', method: 'GET' },
          'admin',
        )
      ).status,
    ).toBe(200);
    expect(service.getCreateOptions).toHaveBeenCalledWith(undefined);
  });
  it('passes a numeric ID for a valid optional query parameter', async () => {
    expect(
      (
        await http.request(
          { path: '/api/equipment/create-options?visibleId=42', method: 'GET' },
          'admin',
        )
      ).status,
    ).toBe(200);
    expect(service.getCreateOptions).toHaveBeenCalledWith(42);
  });
});
