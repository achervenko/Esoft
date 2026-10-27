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
import { WarehouseStockController } from './stock.controller';
import { WarehouseStockQueryService } from './stock-query.service';

describe('Stock HTTP API', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const stock = {
    getBalances: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 }),
    getBalance: jest.fn().mockResolvedValue(null),
    getItemTotal: jest.fn().mockResolvedValue('123456789012.123'),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseStockController],
      providers: [{ provide: WarehouseStockQueryService, useValue: stock }],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it.each(['admin', 'storekeeper'])(
    'allows read access for %s',
    async (role) => {
      for (const path of [
        '/api/warehouse/stock',
        '/api/warehouse/stock/items/1/total',
        '/api/warehouse/stock/items/1/locations/2',
      ])
        expect((await http.request({ method: 'GET', path }, role)).status).toBe(
          200,
        );
    },
  );
  it.each(['operator', 'engineer', 'auditor'])(
    'rejects unrelated role %s',
    async (role) => {
      expect(
        (
          await http.request(
            { method: 'GET', path: '/api/warehouse/stock' },
            role,
          )
        ).status,
      ).toBe(403);
      expect(stock.getBalances).not.toHaveBeenCalled();
    },
  );
  it('requires authentication', async () =>
    expect(
      (await http.request({ method: 'GET', path: '/api/warehouse/stock' }))
        .status,
    ).toBe(401));
  it('parses HTTP filters without losing ID or quantity precision', async () => {
    const r = await http.request(
      {
        method: 'GET',
        path: '/api/warehouse/stock?warehouseId=9007199254740995&itemIds=9007199254740993&itemIds=2&locationIds=3,4&itemActive=false&locationActive=true&page=2&limit=10&minQuantity=0.001&maxQuantity=99999999999.999&quantityState=ALL&sortBy=quantity&sortOrder=desc',
      },
      'storekeeper',
    );
    expect(r.status).toBe(200);
    expect(stock.getBalances).toHaveBeenCalledWith({
      warehouseId: '9007199254740995',
      itemIds: ['9007199254740993', '2'],
      locationIds: ['3', '4'],
      itemActive: false,
      locationActive: true,
      page: 2,
      limit: 10,
      minQuantity: '0.001',
      maxQuantity: '99999999999.999',
      quantityState: 'ALL',
      sortBy: 'quantity',
      sortOrder: 'desc',
    });
  });
  it.each([
    'unknown=1',
    'warehouseId=0',
    'warehouseId=not-a-bigint',
    'page=0',
    'limit=101',
    'itemActive=0',
    'itemActive=true&itemActive=false',
    'itemId=1&itemIds=2',
    'itemIds=1,,2',
    'minQuantity=0.0001',
    'minQuantity=2&maxQuantity=1',
    'sortBy=name',
  ])('rejects invalid query %s', async (query) => {
    expect(
      (
        await http.request(
          { method: 'GET', path: '/api/warehouse/stock?' + query },
          'admin',
        )
      ).status,
    ).toBe(400);
    expect(stock.getBalances).not.toHaveBeenCalled();
  });
  it('returns total quantity as a string', async () => {
    const r = await http.request(
      {
        method: 'GET',
        path: '/api/warehouse/stock/items/9007199254740993/total',
      },
      'admin',
    );
    expect(await r.json()).toEqual({
      itemId: '9007199254740993',
      quantity: '123456789012.123',
    });
  });
  it('passes the warehouse filter as the second total argument', async () => {
    const response = await http.request(
      {
        method: 'GET',
        path: '/api/warehouse/stock/items/1/total?warehouseId=2',
      },
      'admin',
    );
    expect(response.status).toBe(200);
    expect(stock.getItemTotal).toHaveBeenCalledWith('1', '2');
  });
  it('returns explicit null for an absent balance', async () => {
    const response = await http.request(
      { method: 'GET', path: '/api/warehouse/stock/items/1/locations/2' },
      'admin',
    );
    expect(await response.json()).toEqual({ balance: null });
  });
  it('does not expose mutations', async () => {
    expect(
      (
        await http.request(
          { method: 'POST', path: '/api/warehouse/stock' },
          'admin',
        )
      ).status,
    ).toBe(404);
  });
});
