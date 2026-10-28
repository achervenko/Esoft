import * as permissionPolicy from '../../auth/permission-policy';
import { WarehousesService } from '../storage-structure/warehouses.service';
import { WarehouseStorageLocationsService } from '../storage-structure/storage-locations.service';
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import { WarehouseStockOverviewController } from './stock-overview.controller';
import { WarehouseStockOverviewService } from './stock-overview.service';
describe('Stock overview HTTP access', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const overview = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    distribution: jest.fn().mockResolvedValue({ locations: [] }),
  };
  const warehouses = { list: jest.fn().mockResolvedValue({ items: [] }) };
  const locations = { list: jest.fn().mockResolvedValue({ items: [] }) };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseStockOverviewController],
      providers: [
        { provide: WarehousesService, useValue: warehouses },
        { provide: WarehouseStorageLocationsService, useValue: locations },
        { provide: WarehouseStockOverviewService, useValue: overview },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it('allows filter requests with stock.read alone through the permissions guard', async () => {
    jest
      .spyOn(permissionPolicy, 'getUserPermissions')
      .mockReturnValue(['warehouse.stock.read']);
    for (const resource of ['warehouses', 'storage-locations']) {
      const response = await http.request(
        {
          method: 'GET',
          path: `/api/warehouse/stock-overview/filters/${resource}?warehouseId=1&isActive=true&page=2`,
        },
        'admin',
      );
      expect(response.status).toBe(200);
    }
    const query = { warehouseId: '1', isActive: 'true', page: '2' };
    expect(warehouses.list).toHaveBeenCalledWith(query);
    expect(locations.list).toHaveBeenCalledWith(query);
  });
  it.each(['admin', 'storekeeper'])('allows stock readers %s', async (role) => {
    expect(
      (
        await http.request(
          { method: 'GET', path: '/api/warehouse/stock-overview?search=6204' },
          role,
        )
      ).status,
    ).toBe(200);
    expect(overview.list).toHaveBeenCalledWith({ search: '6204' });
    expect(
      (
        await http.request(
          {
            method: 'GET',
            path: '/api/warehouse/stock-overview/items/9007199254740993/warehouses/9007199254740995',
          },
          role,
        )
      ).status,
    ).toBe(200);
    expect(overview.distribution).toHaveBeenCalledWith(
      '9007199254740993',
      '9007199254740995',
    );
  });
  it.each(['operator', 'engineer', 'auditor'])(
    'denies unrelated %s',
    async (role) => {
      for (const path of [
        '/api/warehouse/stock-overview',
        '/api/warehouse/stock-overview/filters/warehouses',
        '/api/warehouse/stock-overview/filters/storage-locations',
        '/api/warehouse/stock-overview/items/1/warehouses/2',
      ])
        expect((await http.request({ method: 'GET', path }, role)).status).toBe(
          403,
        );
      expect(warehouses.list).not.toHaveBeenCalled();
      expect(locations.list).not.toHaveBeenCalled();
      expect(overview.list).not.toHaveBeenCalled();
      expect(overview.distribution).not.toHaveBeenCalled();
    },
  );
});
