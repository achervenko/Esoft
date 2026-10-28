import { WarehousesService } from '../storage-structure/warehouses.service';
import { WarehouseStorageLocationsService } from '../storage-structure/storage-locations.service';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseStockOverviewService } from './stock-overview.service';
@Controller('api/warehouse/stock-overview')
export class WarehouseStockOverviewController {
  constructor(
    private readonly overview: WarehouseStockOverviewService,
    private readonly warehouses: WarehousesService,
    private readonly locations: WarehouseStorageLocationsService,
  ) {}
  @Get('filters/warehouses')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  listWarehouses(@Query() query: unknown) {
    return this.warehouses.list(query);
  }
  @Get('filters/storage-locations')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  listLocations(@Query() query: unknown) {
    return this.locations.list(query);
  }
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  list(@Query() query: unknown) {
    return this.overview.list(query);
  }
  @Get('items/:itemId/warehouses/:warehouseId')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  distribution(
    @Param('itemId') itemId: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    return this.overview.distribution(itemId, warehouseId);
  }
}
