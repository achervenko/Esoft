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
import { WarehouseStorageLocationsController } from './storage-locations.controller';
import { WarehouseStorageLocationsService } from './storage-locations.service';

describe('Storage locations HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseStorageLocationsController],
      providers: [
        { provide: WarehouseStorageLocationsService, useValue: service },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const operations = [
    { method: 'GET', path: '/api/warehouse/storage-locations' },
    { method: 'GET', path: '/api/warehouse/storage-locations/1' },
    { method: 'POST', path: '/api/warehouse/storage-locations' },
    { method: 'PATCH', path: '/api/warehouse/storage-locations/1' },
  ];
  it.each(['admin', 'storekeeper'])('allows %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBeLessThan(300);
  });
  it.each(['engineer', 'operator', 'auditor'])('denies %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('has no DELETE route', async () =>
    expect(
      (
        await http.request(
          { method: 'DELETE', path: '/api/warehouse/storage-locations/1' },
          'admin',
        )
      ).status,
    ).toBe(404));
});
