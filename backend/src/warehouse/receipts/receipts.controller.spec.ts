import { WarehouseReceiptsQueryService } from './receipts-query.service';
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
import { WarehouseReceiptsController } from './receipts.controller';
import { WarehouseReceiptsService } from './receipts.service';

describe('Receipts HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({}),
    createManual: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseReceiptsController],
      providers: [
        { provide: WarehouseReceiptsQueryService, useValue: service },
        { provide: WarehouseReceiptsService, useValue: service },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  const operations = [
    { method: 'GET', path: '/api/warehouse/receipts' },
    { method: 'GET', path: '/api/warehouse/receipts/1' },
    { method: 'POST', path: '/api/warehouse/receipts' },
  ];
  it.each(['admin', 'storekeeper'])('allows %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBeLessThan(300);
  });
  it.each(['engineer', 'operator', 'auditor'])('denies %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBe(403);
    expect(service.createManual).not.toHaveBeenCalled();
  });
  it('POST returns 201 for both creation and replay', async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await http.request(
            { method: 'POST', path: '/api/warehouse/receipts' },
            'storekeeper',
          )
        ).status,
      ).toBe(201);
  });
  it('has no PATCH route', async () =>
    expect(
      (
        await http.request(
          { method: 'PATCH', path: '/api/warehouse/receipts/1' },
          'admin',
        )
      ).status,
    ).toBe(404));
  it('has no DELETE route', async () =>
    expect(
      (
        await http.request(
          { method: 'DELETE', path: '/api/warehouse/receipts/1' },
          'admin',
        )
      ).status,
    ).toBe(404));
});
