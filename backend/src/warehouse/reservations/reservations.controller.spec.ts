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
import { WarehouseReservationsController } from './reservations.controller';
import { WarehouseReservationsApiService } from './reservations-api.service';

describe('Reservations HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    release: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseReservationsController],
      providers: [
        { provide: WarehouseReservationsApiService, useValue: service },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const operations = [
    { method: 'GET', path: '/api/warehouse/reservations' },
    { method: 'DELETE', path: '/api/warehouse/reservations/1' },
    { method: 'POST', path: '/api/warehouse/reservations' },
    { method: 'PATCH', path: '/api/warehouse/reservations/1' },
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
  it('requires authentication for every operation', async () => {
    for (const operation of operations)
      expect((await http.request(operation)).status).toBe(401);
  });
  it('uses the session actor for mutations', async () => {
    await http.request(
      {
        method: 'POST',
        path: '/api/warehouse/reservations',
        body: {
          balanceId: '15',
          projectId: '7',
          quantity: '12',
          actorUserId: 'untrusted',
        },
      },
      'storekeeper',
    );
    expect(service.create).toHaveBeenCalledWith(expect.any(Object), 'actor');
    await http.request(
      {
        method: 'PATCH',
        path: '/api/warehouse/reservations/15',
        body: { quantity: '5' },
      },
      'storekeeper',
    );
    expect(service.update).toHaveBeenCalledWith(
      '15',
      { quantity: '5' },
      'actor',
    );
    await http.request(
      { method: 'DELETE', path: '/api/warehouse/reservations/15' },
      'storekeeper',
    );
    expect(service.release).toHaveBeenCalledWith('15', 'actor');
  });
});
