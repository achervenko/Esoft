import * as permissions from '../../auth/permission-policy';
import { WarehouseReceiptPlacementsService } from './receipt-placements.service';
import { WarehouseReceiptItemMappingService } from './receipt-item-mapping.service';
import { WarehouseReceiptReconciliationService } from './receipt-reconciliation.service';
import { WarehouseReceiptConflictResolutionService } from './receipt-conflict-resolution.service';
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
    reconciliationCandidates: jest.fn().mockResolvedValue({ items: [] }),
    list: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({}),
    createManual: jest.fn().mockResolvedValue({}),
    cancelManual: jest.fn().mockResolvedValue({}),
    place: jest.fn().mockResolvedValue({}),
    mapItem: jest.fn().mockResolvedValue({}),
    reconcile: jest.fn().mockResolvedValue({}),
    resolve: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseReceiptsController],
      providers: [
        { provide: WarehouseReceiptPlacementsService, useValue: service },
        { provide: WarehouseReceiptItemMappingService, useValue: service },

        { provide: WarehouseReceiptReconciliationService, useValue: service },
        {
          provide: WarehouseReceiptConflictResolutionService,
          useValue: service,
        },
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
    {
      method: 'GET',
      path: '/api/warehouse/receipts/1/reconciliation-candidates',
    },
    { method: 'POST', path: '/api/warehouse/receipts' },
    { method: 'POST', path: '/api/warehouse/receipts/1/cancel' },
    { method: 'POST', path: '/api/warehouse/receipts/1/lines/2/placements' },
    { method: 'POST', path: '/api/warehouse/receipts/1/lines/2/item-link' },
    { method: 'POST', path: '/api/warehouse/receipts/1/reconcile' },
  ];
  it.each(['admin', 'storekeeper'])('allows %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBeLessThan(300);
    expect(service.cancelManual).toHaveBeenCalledTimes(1);
  });
  it('does not expose candidates without receipt mapping permission', async () => {
    const mock = jest
      .spyOn(permissions, 'getUserPermissions')
      .mockReturnValue(['warehouse.receipts.read']);
    try {
      expect(
        (
          await http.request(
            {
              method: 'GET',
              path: '/api/warehouse/receipts/1/reconciliation-candidates',
            },
            'admin',
          )
        ).status,
      ).toBe(403);
      expect(service.reconciliationCandidates).not.toHaveBeenCalled();
    } finally {
      mock.mockRestore();
    }
  });
  it.each(['engineer', 'operator', 'auditor'])('denies %s', async (role) => {
    for (const op of operations)
      expect((await http.request(op, role)).status).toBe(403);
    expect(service.createManual).not.toHaveBeenCalled();
    expect(service.cancelManual).not.toHaveBeenCalled();
  });
  const resolveOperation = {
    method: 'POST',
    path: '/api/warehouse/receipts/1/resolve-conflict',
  };
  it('allows admin to resolve conflicts', async () => {
    expect((await http.request(resolveOperation, 'admin')).status).toBe(201);
    expect(service.resolve).toHaveBeenCalledTimes(1);
  });
  it.each(['storekeeper', 'engineer', 'operator', 'auditor'])(
    'denies conflict resolution for %s',
    async (role) => {
      expect((await http.request(resolveOperation, role)).status).toBe(403);
      expect(service.resolve).not.toHaveBeenCalled();
    },
  );
  it('requires integrations.manage even when receipt manage and map are granted', async () => {
    const mock = jest
      .spyOn(permissions, 'getUserPermissions')
      .mockReturnValue(['warehouse.receipts.manage', 'warehouse.receipts.map']);
    try {
      expect((await http.request(resolveOperation, 'admin')).status).toBe(403);
      expect(service.resolve).not.toHaveBeenCalled();
    } finally {
      mock.mockRestore();
    }
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
  it('requires Catalog link permission in addition to receipt mapping', async () => {
    const mock = jest
      .spyOn(permissions, 'getUserPermissions')
      .mockReturnValue(['warehouse.receipts.map']);
    try {
      expect(
        (
          await http.request(
            {
              method: 'POST',
              path: '/api/warehouse/receipts/1/lines/2/item-link',
            },
            'admin',
          )
        ).status,
      ).toBe(403);
      expect(service.mapItem).not.toHaveBeenCalled();
    } finally {
      mock.mockRestore();
    }
  });
  it('has no warehouse mapping route for storekeepers or admins', async () => {
    for (const role of ['storekeeper', 'admin'])
      expect(
        (
          await http.request(
            {
              method: 'POST',
              path: '/api/warehouse/receipts/1/warehouse-link',
            },
            role,
          )
        ).status,
      ).toBe(404);
  });
  it('requires administrative integration access rather than the actor import permission', async () => {
    const mock = jest
      .spyOn(permissions, 'getUserPermissions')
      .mockReturnValue(['warehouse.receipts.integration']);
    try {
      expect((await http.request(resolveOperation, 'admin')).status).toBe(403);
    } finally {
      mock.mockRestore();
    }
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
