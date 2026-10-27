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
import { WarehouseIssuesController } from './issues.controller';
import { WarehouseIssuesService } from './issues.service';
import { WarehouseIssuesQueryService } from './issues-query.service';

describe('Issues HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const issues = {
    createIssue: jest.fn().mockResolvedValue({}),
    previewOverride: jest.fn().mockResolvedValue({}),
  };
  const queries = {
    list: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({}),
    available: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseIssuesController],
      providers: [
        { provide: WarehouseIssuesService, useValue: issues },
        { provide: WarehouseIssuesQueryService, useValue: queries },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it.each(['admin', 'storekeeper'])(
    'allows normal issue operations for %s',
    async (role) => {
      for (const operation of [
        { method: 'GET', path: '/api/warehouse/issues' },
        { method: 'GET', path: '/api/warehouse/issues/1' },
        {
          method: 'GET',
          path: '/api/warehouse/issues/available-balances?itemId=1',
        },
        { method: 'POST', path: '/api/warehouse/issues' },
      ])
        expect((await http.request(operation, role)).status).toBeLessThan(300);
    },
  );
  it.each([
    'storekeeper',
    'engineer',
    'accounting_specialist',
    'ppe_specialist',
  ])('does not grant override preview to %s', async (role) => {
    expect(
      (
        await http.request(
          { method: 'POST', path: '/api/warehouse/issues/override-preview' },
          role,
        )
      ).status,
    ).toBe(403);
    expect(issues.previewOverride).not.toHaveBeenCalled();
  });
  it('forwards historical search and period filters unchanged', async () => {
    await http.request(
      {
        method: 'GET',
        path: '/api/warehouse/issues?search=OLD-ARTICLE&warehouseId=9007199254740995&createdFrom=2025-01-01&createdTo=2025-12-31T23%3A59%3A59.999Z',
      },
      'storekeeper',
    );
    expect(queries.list).toHaveBeenCalledWith({
      search: 'OLD-ARTICLE',
      warehouseId: '9007199254740995',
      createdFrom: '2025-01-01',
      createdTo: '2025-12-31T23:59:59.999Z',
    });
  });
  it('allows override preview to admin', async () => {
    expect(
      (
        await http.request(
          { method: 'POST', path: '/api/warehouse/issues/override-preview' },
          'admin',
        )
      ).status,
    ).toBeLessThan(300);
  });
  it('rejects unrelated roles and unauthenticated sessions', async () => {
    expect(
      (
        await http.request(
          { method: 'POST', path: '/api/warehouse/issues' },
          'accounting_specialist',
        )
      ).status,
    ).toBe(403);
    expect(
      (await http.request({ method: 'POST', path: '/api/warehouse/issues' }))
        .status,
    ).toBe(401);
    expect(issues.createIssue).not.toHaveBeenCalled();
  });
});
