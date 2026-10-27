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
import { WarehouseTransfersController } from './transfers.controller';
import { WarehouseTransfersService } from './transfers.service';

describe('Transfers HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseTransfersController],
      providers: [{ provide: WarehouseTransfersService, useValue: service }],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const operations = [
    { method: 'GET', path: '/api/warehouse/transfers' },
    { method: 'GET', path: '/api/warehouse/transfers/1' },
    { method: 'POST', path: '/api/warehouse/transfers' },
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
  it('POST returns 201 for both creation and replay', async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await http.request(
            { method: 'POST', path: '/api/warehouse/transfers' },
            'storekeeper',
          )
        ).status,
      ).toBe(201);
  });
  it('forwards command and actor', async () => {
    const body = {
      requestKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      itemId: '1',
      fromLocationId: '2',
      toLocationId: '3',
      quantity: '4',
    };
    const response = await http.request(
      { method: 'POST', path: '/api/warehouse/transfers', body },
      'storekeeper',
    );
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(body, expect.any(String));
  });
  it('forwards list filters including warehouseId without number conversion', async () => {
    await http.request(
      {
        method: 'GET',
        path: '/api/warehouse/transfers?warehouseId=9007199254740995&itemId=1&page=2&limit=10',
      },
      'storekeeper',
    );
    expect(service.list).toHaveBeenCalledWith({
      warehouseId: '9007199254740995',
      itemId: '1',
      page: '2',
      limit: '10',
    });
  });
  it('requires authentication', async () => {
    expect(
      (await http.request({ method: 'GET', path: '/api/warehouse/transfers' }))
        .status,
    ).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('has no PATCH route', async () =>
    expect(
      (
        await http.request(
          { method: 'PATCH', path: '/api/warehouse/transfers/1' },
          'admin',
        )
      ).status,
    ).toBe(404));
  it('has no DELETE route', async () =>
    expect(
      (
        await http.request(
          { method: 'DELETE', path: '/api/warehouse/transfers/1' },
          'admin',
        )
      ).status,
    ).toBe(404));
});
