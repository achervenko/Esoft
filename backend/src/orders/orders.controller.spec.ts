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
import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersSyncService } from './orders-sync.service';
describe('Orders permissions by enabled module', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const orders = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    sources: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    history: jest.fn().mockResolvedValue({ items: [] }),
  };
  const sync = { sync: jest.fn().mockResolvedValue({ outcome: 'SUCCESS' }) };
  const id = '8f23444c-b5ab-11f1-9606-40a8f031fdf3';
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: orders },
        { provide: OrdersSyncService, useValue: sync },
      ],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it.each(['admin', 'storekeeper'])(
    'checks directory access for %s with its role enabled',
    async (role) => {
      http.modules.splice(0, http.modules.length, 'orders');
      if (role === 'storekeeper') http.modules.push('warehouse');
      for (const path of [
        '/api/orders',
        '/api/orders/sources',
        `/api/orders/${id}`,
        `/api/orders/${id}/history`,
      ])
        expect((await http.request({ method: 'GET', path }, role)).status).toBe(
          role === 'admin' ? 200 : 403,
        );
      if (role === 'storekeeper') {
        expect(orders.list).not.toHaveBeenCalled();
        expect(orders.sources).not.toHaveBeenCalled();
        expect(orders.findOne).not.toHaveBeenCalled();
        expect(orders.history).not.toHaveBeenCalled();
      }
    },
  );
  it('denies order reads when the orders package is disabled', async () => {
    http.modules.splice(0, http.modules.length, 'warehouse');
    expect(
      (await http.request({ method: 'GET', path: '/api/orders' }, 'admin'))
        .status,
    ).toBe(403);
  });
  it('only allows an administrator to refresh', async () => {
    const op = { method: 'POST', path: `/api/orders/sources/${id}/refresh` };
    expect((await http.request(op, 'storekeeper')).status).toBe(403);
    expect(sync.sync).not.toHaveBeenCalled();
    expect((await http.request(op, 'admin')).status).toBe(200);
  });
  it('requires login and read permissions', async () => {
    expect(
      (await http.request({ method: 'GET', path: '/api/orders' })).status,
    ).toBe(401);
    expect(
      (await http.request({ method: 'GET', path: '/api/orders' }, 'engineer'))
        .status,
    ).toBe(403);
    expect(orders.list).not.toHaveBeenCalled();
  });
  it.each(['PATCH', 'DELETE'])(
    'does not expose %s for an order',
    async (method) =>
      expect(
        (await http.request({ method, path: `/api/orders/${id}` }, 'admin'))
          .status,
      ).toBe(404),
  );
});
