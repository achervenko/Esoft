jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, ctx: import('@nestjs/common').ExecutionContext) =>
        ctx.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import { WarehouseProjectsController } from './projects.controller';
import { WarehouseProjectsService } from './projects.service';

describe('Projects stub HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseProjectsController],
      providers: [{ provide: WarehouseProjectsService, useValue: service }],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const operations = [
    { method: 'GET', path: '/api/warehouse/projects' },
    { method: 'GET', path: '/api/warehouse/projects/1' },
  ];
  it.each(['admin', 'storekeeper'])('allows %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBeLessThan(300);
  });
  it.each(['engineer', 'operator', 'auditor'])('denies %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.findOne).not.toHaveBeenCalled();
  });
  it('requires authentication', async () => {
    for (const op of operations)
      expect((await http.request(op)).status).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PATCH', 'DELETE'])(
    'does not provide %s mutations',
    async (method) =>
      expect(
        (
          await http.request(
            {
              method,
              path:
                method === 'POST'
                  ? '/api/warehouse/projects'
                  : '/api/warehouse/projects/1',
            },
            'admin',
          )
        ).status,
      ).toBe(404),
  );
});
