import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseStockQueryService } from './stock-query.service';
import { parseStockHttpQuery } from './stock-http.validation';

@Controller('api/warehouse/stock')
export class WarehouseStockController {
  constructor(private readonly stock: WarehouseStockQueryService) {}

  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  list(@Query() query: unknown) {
    return this.stock.getBalances(parseStockHttpQuery(query));
  }

  @Get('items/:itemId/total')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  async total(
    @Param('itemId') itemId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return {
      itemId,
      quantity: await this.stock.getItemTotal(itemId, warehouseId),
    };
  }

  @Get('items/:itemId/locations/:locationId')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STOCK_READ)
  async balance(
    @Param('itemId') itemId: string,
    @Param('locationId') locationId: string,
  ) {
    return { balance: await this.stock.getBalance(itemId, locationId) };
  }
}
